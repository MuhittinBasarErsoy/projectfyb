# ---- Build aşaması ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Not: wasm-tools KURULMUYOR. Kurulursa publish native relink (emscripten/python) dener
# ve SDK imajında python olmadığından hata verir. Varsayılan WASM publish (IL) yeterli.

COPY specs/ ./specs/
COPY src/FyBlue.Contracts/ ./src/FyBlue.Contracts/
COPY src/Osos.Core/ ./src/Osos.Core/
COPY src/Osos.Contracts/ ./src/Osos.Contracts/
COPY src/Epias.Core/ ./src/Epias.Core/
COPY src/Epias.Contracts/ ./src/Epias.Contracts/
COPY src/FyBlue.Web/ ./src/FyBlue.Web/
COPY src/FyBlue.Server/ ./src/FyBlue.Server/

RUN dotnet restore src/FyBlue.Server/FyBlue.Server.csproj
RUN dotnet publish src/FyBlue.Server/FyBlue.Server.csproj -c Release -o /app/publish --no-restore

# Hosted publish'te index.html'deki bootstrap yer tutucusu (#[.{fingerprint}]) çözülmüyor →
# gerçek dosya adıyla değiştir. dotnet.* dosyaları fingerprint kapalı olduğu için düz adlarla üretilir.
RUN cd /app/publish/wwwroot && \
    BOOT=$(basename $(ls _framework/blazor.webassembly*.js | grep -vE '\.(br|gz)$' | head -1)) && \
    sed -i "s/blazor\.webassembly#\[\.{fingerprint}\]\.js/$BOOT/g" index.html && \
    echo "index.html bootstrap -> $BOOT"

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
