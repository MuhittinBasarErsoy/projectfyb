using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using FyBlue.Contracts;
using FyBlue.Server.Data;
using FyBlue.Server.Services;

namespace FyBlue.Server.Controllers;

/// <summary>Tek kayıt / tek giriş. OSOS ve EPİAŞ hesapları giriş sonrası ayrıca bağlanır.</summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _users;
    private readonly TokenService _tokens;

    public AuthController(UserManager<AppUser> users, TokenService tokens)
    {
        _users = users;
        _tokens = tokens;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req)
    {
        var user = new AppUser { UserName = req.Username?.Trim(), Email = req.Email?.Trim() };
        var result = await _users.CreateAsync(user, req.Password ?? "");
        if (!result.Succeeded)
            return BadRequest(new ApiProblem(string.Join(" ", result.Errors.Select(e => e.Description))));

        var (token, exp) = _tokens.Create(user);
        return new AuthResponse(token, exp, user.UserName!);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(AppLoginRequest req)
    {
        var user = await _users.FindByNameAsync(req.Username?.Trim() ?? "");
        if (user is null || !await _users.CheckPasswordAsync(user, req.Password ?? ""))
            return Unauthorized(new ApiProblem("Kullanıcı adı veya şifre hatalı."));

        var (token, exp) = _tokens.Create(user);
        return new AuthResponse(token, exp, user.UserName!);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ProfileResponse>> Me()
    {
        var user = await _users.FindByIdAsync(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (user is null) return Unauthorized(new ApiProblem("Oturum geçersiz."));
        return new ProfileResponse(user.UserName!, user.Email, user.CreatedAt);
    }
}
