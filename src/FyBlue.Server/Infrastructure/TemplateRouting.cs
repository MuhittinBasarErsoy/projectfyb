namespace FyBlue.Server.Infrastructure;

/// <summary>
/// Kullanıcının seçtiği arayüz şablonuna yönlendirme. Seçim, şablonların giriş
/// ekranında yazılan <c>fyblue_template</c> çerezinde tutulur.
/// </summary>
public static class TemplateRouting
{
    public const string Cookie = "fyblue_template";
    public const string Default = "tailadmin";
    public static readonly string[] Templates = ["tailadmin", "shadcn", "starter"];

    // Eski (Blazor) adresler şablonlardaki karşılıklarına çevrilir.
    private static readonly Dictionary<string, string> Legacy = new(StringComparer.OrdinalIgnoreCase)
    {
        ["login"] = "signin",
        ["register"] = "signup",
    };

    public static IResult Redirect(HttpContext ctx)
    {
        var path = ctx.Request.Path.Value?.Trim('/') ?? "";

        // Eşleşmeyen API / sistem yolları yönlendirilmez.
        if (path.StartsWith("api/", StringComparison.OrdinalIgnoreCase) || path.Equals("api", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("hangfire", StringComparison.OrdinalIgnoreCase))
            return Results.NotFound();

        var template = ctx.Request.Cookies.TryGetValue(Cookie, out var t) && Templates.Contains(t) ? t : Default;
        var target = Legacy.TryGetValue(path, out var mapped) ? mapped : path;
        var url = $"/{template}/{target}{ctx.Request.QueryString}";
        return Results.Redirect(url);
    }
}
