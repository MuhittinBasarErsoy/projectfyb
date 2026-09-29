using Epias.Core.Epias;
using FyBlue.Contracts;
using FyBlue.Server.Security;
using FyBlue.Server.Services;
using FyBlue.Server.Services.Customers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FyBlue.Server.Infrastructure;

/// <summary>
/// Dış hesap (OSOS / EPİAŞ) hatalarını 409 + kodlu gövdeye, yetki/kayıt/doğrulama hatalarını 403/404/400'e çevirir.
/// 401 yalnızca uygulama oturumu için kullanılır; aksi halde bir dış hesap
/// hatası istemcinin FyBlue oturumunu kapatırdı.
/// </summary>
public sealed class ApiExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        int? status = context.Exception switch
        {
            ForbiddenException => StatusCodes.Status403Forbidden,
            NotFoundException => StatusCodes.Status404NotFound,
            ValidationException => StatusCodes.Status400BadRequest,
            _ => null
        };
        if (status is not null)
        {
            context.Result = new ObjectResult(new ApiProblem(context.Exception.Message)) { StatusCode = status };
            context.ExceptionHandled = true;
            return;
        }

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
