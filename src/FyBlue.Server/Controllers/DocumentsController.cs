using FyBlue.Contracts;
using FyBlue.Server.Data;
using FyBlue.Server.Services.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers;

/// <summary>
/// Belgeler ve faturalar. Müşteri de danışman da yükleyebilir; müşteri silemez (kendi yüklediğini de),
/// danışman pasife alır (fiziksel silme yok, dosya diskte kalır).
/// </summary>
[ApiController]
[Authorize]
[Route("api")]
public sealed class DocumentsController : ControllerBase
{
    public const long MaxFileSize = 20 * 1024 * 1024;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff",
        ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".xml", ".zip", ".rar", ".7z", ".dwg"
    };

    private readonly AppDbContext _db;
    private readonly CurrentUser _me;
    private readonly IFileStorage _files;

    public DocumentsController(AppDbContext db, CurrentUser me, IFileStorage files)
    {
        _db = db;
        _me = me;
        _files = files;
    }

    [HttpGet("customers/{customerId:int}/documents")]
    public async Task<IReadOnlyList<DocumentDto>> List(int customerId, int? documentTypeId, int? installationId,
        bool includeInactive = false, CancellationToken ct = default)
    {
        await _me.EnsureCanAccessCustomerAsync(customerId, ct);
        var q = _db.Documents.AsNoTracking().Where(d => d.CustomerId == customerId);
        // Pasif (silinmiş) belgeleri yalnızca danışman görebilir.
        if (!includeInactive || !await _me.IsConsultantAsync(ct)) q = q.Where(d => d.IsActive);
        if (documentTypeId is int t) q = q.Where(d => d.DocumentTypeId == t);
        if (installationId is int i) q = q.Where(d => d.InstallationId == i);

        var docs = await q.OrderByDescending(d => d.DocumentDate ?? DateOnly.FromDateTime(d.CreatedAt)).ThenByDescending(d => d.Id)
            .Select(d => new
            {
                d,
                InstallationName = d.Installation != null ? d.Installation.Name : null,
                TypeName = d.DocumentType!.Name,
                TypeCode = d.DocumentType.Code,
            }).ToListAsync(ct);
        var uploaderIds = docs.Select(x => x.d.UploadedByUserId).OfType<string>().Distinct().ToList();
        var names = await _db.Users.AsNoTracking().Where(u => uploaderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.UserName, ct);

        return docs.Select(x => new DocumentDto(x.d.Id, x.d.CustomerId, x.d.InstallationId, x.InstallationName,
            x.d.DocumentTypeId, x.TypeName, x.TypeCode, x.d.Title, x.d.FileName, x.d.MimeType, x.d.FileSize,
            x.d.DocumentDate, x.d.PeriodYear, x.d.PeriodMonth, x.d.ExpiryDate, x.d.Description, x.d.UploadedByType,
            x.d.UploadedByUserId is { } uid && names.TryGetValue(uid, out var n) ? n : null, x.d.IsActive, x.d.CreatedAt)).ToList();
    }

    [HttpPost("customers/{customerId:int}/documents")]
    [RequestSizeLimit(MaxFileSize + 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSize + 1024 * 1024)]
    public async Task<IActionResult> Upload(int customerId, [FromForm] DocumentUploadForm form, CancellationToken ct)
    {
        await _me.EnsureCanAccessCustomerAsync(customerId, ct);
        if (!await _db.Customers.AnyAsync(c => c.Id == customerId, ct)) throw new NotFoundException();
        var file = form.File ?? throw new ValidationException("Dosya seçilmedi.");
        if (file.Length == 0) throw new ValidationException("Dosya boş.");
        if (file.Length > MaxFileSize) throw new ValidationException("Dosya en fazla 20 MB olabilir.");
        var ext = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(ext)) throw new ValidationException($"'{ext}' uzantılı dosya yüklenemez.");
        if (!await _db.ParameterValues.AnyAsync(v => v.Id == form.DocumentTypeId && v.IsActive
                                                     && v.ParameterGroup!.Code == ParameterGroupCodes.DocumentType, ct))
            throw new ValidationException("Geçersiz belge tipi.");
        if (form.InstallationId is int iid && !await _db.Installations.AnyAsync(i => i.Id == iid && i.CustomerId == customerId, ct))
            throw new ValidationException("Tesisat bu müşteriye ait değil.");
        if (form.PeriodMonth is < 1 or > 12) throw new ValidationException("Dönem ayı 1–12 olmalı.");

        var key = $"{customerId}/{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        await using (var s = file.OpenReadStream()) await _files.SaveAsync(key, s, ct);

        bool consultant = await _me.IsConsultantAsync(ct);
        var fileName = Path.GetFileName(file.FileName);
        var doc = new Document
        {
            CustomerId = customerId,
            InstallationId = form.InstallationId,
            DocumentTypeId = form.DocumentTypeId,
            Title = CustomersController.Clean(form.Title) ?? Path.GetFileNameWithoutExtension(fileName),
            FileName = fileName.Length > 300 ? fileName[^300..] : fileName,
            StorageKey = key,
            MimeType = file.ContentType,
            FileSize = file.Length,
            DocumentDate = form.DocumentDate,
            PeriodYear = form.PeriodYear,
            PeriodMonth = form.PeriodMonth,
            ExpiryDate = form.ExpiryDate,
            Description = CustomersController.Clean(form.Description),
            UploadedByUserId = _me.Id,
            UploadedByType = consultant ? UploaderTypes.Consultant : UploaderTypes.Customer,
        };
        _db.Documents.Add(doc);
        await _db.SaveChangesAsync(ct);
        return Ok(new { doc.Id });
    }

    [HttpGet("documents/{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        var doc = await _db.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new NotFoundException();
        await _me.EnsureCanAccessCustomerAsync(doc.CustomerId, ct);
        if (!doc.IsActive && !await _me.IsConsultantAsync(ct)) throw new NotFoundException();
        return File(_files.OpenRead(doc.StorageKey), doc.MimeType ?? "application/octet-stream", doc.FileName);
    }

    /// <summary>Danışman: belgeyi pasife alır (silindi olarak işaretler). Müşteri kullanıcısı → 403.</summary>
    [HttpDelete("documents/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new NotFoundException();
        doc.IsActive = false;
        doc.DeletedAt = DateTime.UtcNow;
        doc.DeletedByUserId = _me.Id;
        doc.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Danışman: pasife alınmış belgeyi geri alır.</summary>
    [HttpPost("documents/{id:int}/restore")]
    public async Task<IActionResult> Restore(int id, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new NotFoundException();
        doc.IsActive = true;
        doc.DeletedAt = null;
        doc.DeletedByUserId = null;
        doc.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public sealed class DocumentUploadForm
{
    public IFormFile? File { get; set; }
    public int DocumentTypeId { get; set; }
    public int? InstallationId { get; set; }
    public string? Title { get; set; }
    public DateOnly? DocumentDate { get; set; }
    public int? PeriodYear { get; set; }
    public int? PeriodMonth { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? Description { get; set; }
}
