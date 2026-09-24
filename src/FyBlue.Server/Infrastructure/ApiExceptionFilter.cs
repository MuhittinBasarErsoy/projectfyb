using Epias.Core.Epias;
using FyBlue.Contracts;
using FyBlue.Server.Security;
using FyBlue.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FyBlue.Server.Infrastructure;

/// <summary>
/// Dış hesap (OSOS / EPİAŞ) hatalarını 409 + kodlu gövdeye çevirir.
/// 401 yalnızca uygulama oturumu için kullanılır; aksi halde bir dış hesap
/// hatası istemcinin FyBlue oturumunu kapatırdı.
/// </summary>
public sealed class ApiExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var problem = context.Exception switch
        {
            OsosNotLinkedException ex => new ApiProblem(ex.Message, ApiErrorCodes.OsosNotLinked),
            EpiasNotLinkedException ex => new ApiProblem(ex.Message, ApiErrorCodes.EpiasNotLinked),
            EpiasAuthenticationException ex => new ApiProblem(ex.Message, ApiErrorCodes.EpiasAuthFailed),
            _ => null
        };
        if (problem is null) return;

        context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status409Conflict };
        context.ExceptionHandled = true;
    }
}
