# ---- Arayüz şablonları (React: TailAdmin, Shadcn Dashboard, Next.js Starter) ----
FROM node:22-bookworm-slim AS web
WORKDIR /web

# Önce yalnızca paket tanımları: bağımlılık katmanı kaynak değişmedikçe önbellekten gelir.
COPY web/package.json web/package-lock.json web/.npmrc ./
COPY web/packages/core/package.json ./packages/core/
COPY web/apps/tailadmin/package.json ./apps/tailadmin/
COPY web/apps/shadcn/package.json ./apps/shadcn/
COPY web/apps/starter/package.json ./apps/starter/
RUN npm ci --no-audit --no-fund

COPY web/ ./
# Derleme çıktıları ../src/FyBlue.Server/wwwroot/<şablon> klasörlerine yazılır.
RUN mkdir -p /src/FyBlue.Server/wwwroot
RUN NEXT_TELEMETRY_DISABLED=1 npm run build

# ---- .NET derleme ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY specs/ ./specs/
COPY src/FyBlue.Contracts/ ./src/FyBlue.Contracts/
COPY src/Osos.Core/ ./src/Osos.Core/
COPY src/Osos.Contracts/ ./src/Osos.Contracts/
COPY src/Epias.Core/ ./src/Epias.Core/
COPY src/Epias.Contracts/ ./src/Epias.Contracts/
COPY src/FyBlue.Server/ ./src/FyBlue.Server/

RUN dotnet restore src/FyBlue.Server/FyBlue.Server.csproj
RUN dotnet publish src/FyBlue.Server/FyBlue.Server.csproj -c Release -o /app/publish --no-restore

# Şablonların derlenmiş hâli (web aşamasından)
COPY --from=web /src/FyBlue.Server/wwwroot/ /app/publish/wwwroot/

# ---- Runtime aşaması ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# SqlClient ve tarih/sayı biçimleri için ICU (tr-TR) gerekli.
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DataProtection__KeyPath=/var/lib/fyblue/keys
EXPOSE 8080

ENTRYPOINT ["dotnet", "FyBlue.Server.dll"]
