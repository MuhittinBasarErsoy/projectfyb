namespace FyBlue.Server.Services.Customers;

/// <summary>Belge dosyalarının saklandığı yer. documents.storage_key bu soyutlamaya göredir.</summary>
public interface IFileStorage
{
    Task SaveAsync(string key, Stream content, CancellationToken ct);
    Stream OpenRead(string key);
}

/// <summary>
/// Yerel disk (Docker'da kalıcı volume). Yol Storage:FilesPath; boşsa içerik kökünde .files.
/// Anahtar: {customerId}/{guid}{uzantı} — kullanıcı dosya adı yola girmez.
/// </summary>
public sealed class LocalFileStorage : IFileStorage
{
    private readonly string _root;

    public LocalFileStorage(IConfiguration config, IWebHostEnvironment env)
    {
        var path = config["Storage:FilesPath"];
        _root = Path.GetFullPath(string.IsNullOrWhiteSpace(path) ? Path.Combine(env.ContentRootPath, ".files") : path);
        Directory.CreateDirectory(_root);
    }

    public async Task SaveAsync(string key, Stream content, CancellationToken ct)
    {
        var full = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        await using var fs = File.Create(full);
        await content.CopyToAsync(fs, ct);
    }

    public Stream OpenRead(string key)
    {
        var full = Resolve(key);
        if (!File.Exists(full)) throw new NotFoundException("Dosya bulunamadı.");
        return File.OpenRead(full);
    }

    private string Resolve(string key)
    {
        var full = Path.GetFullPath(Path.Combine(_root, key));
        if (!full.StartsWith(_root, StringComparison.Ordinal)) throw new ValidationException("Geçersiz dosya anahtarı.");
        return full;
    }
}
