using Microsoft.JSInterop;

namespace FyBlue.Web.Services;

/// <summary>Arayüz şablonu (kabuk tasarımı). Kimlik, <c>html[data-skin]</c> değeri olarak kullanılır.</summary>
public sealed record Skin(string Id, string Name, string Origin, string Description);

/// <summary>
/// Seçili arayüz şablonu. Seçim tarayıcıda saklanır (<c>fyblue.skin</c>) ve
/// <c>index.html</c> onu ilk boyamadan önce uygular.
/// </summary>
public sealed class SkinState(IJSRuntime js)
{
    public const string DefaultId = "tailadmin";

    public static readonly IReadOnlyList<Skin> All =
    [
        new("tailadmin", "TailAdmin", "TailAdmin · React + Tailwind",
            "Outfit yazı tipi, mavi marka rengi, geniş beyaz menü ve yuvarlak kartlar."),
        new("shadcn", "Shadcn Dashboard", "shadcndashboard · Lyra stili",
            "Geist yazı tipi, nötr gri tonlar, keskin köşeler ve çerçeveli yan menü."),
        new("starter", "Next Shadcn Starter", "kiranism · Vercel teması",
            "Siyah-beyaz Vercel teması, yol çubuğu (breadcrumb) ve menü altında kullanıcı kartı."),
        new("classic", "FyBlue Klasik", "Mevcut tasarım",
            "FyBlue'nun ilk tasarımı: mor-mavi geçişli marka ve yumuşak gölgeler."),
    ];

    public string Current { get; private set; } = DefaultId;

    public Skin CurrentSkin => All.FirstOrDefault(s => s.Id == Current) ?? All[0];

    public event Action? Changed;

    public async Task InitializeAsync()
    {
        try { Current = Normalize(await js.InvokeAsync<string?>("fyblue.getSkin")); }
        catch (JSException) { }
    }

    public async Task SetAsync(string id)
    {
        id = Normalize(id);
        if (id == Current) return;
        Current = id;
        try { await js.InvokeVoidAsync("fyblue.setSkin", id); }
        catch (JSException) { }
        Changed?.Invoke();
    }

    private static string Normalize(string? id) =>
        All.Any(s => s.Id == id) ? id! : DefaultId;
}
