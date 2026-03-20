{ pkgs, config, lib, ... }:

let
  # SurrealDB v3 is not yet in nixpkgs (stuck at 2.x with build issues).
  # Fetch the official prebuilt binary instead.
  surrealdb-v3 =
    let
      sources = {
        "x86_64-linux" = {
          url = "https://github.com/surrealdb/surrealdb/releases/download/v3.0.1/surreal-v3.0.1.linux-amd64.tgz";
          hash = "sha256-zKSlw6DAWgWzA2GEa9wsHFUr9rOHaGSUcQEeemSoH0Y=";
        };
        "aarch64-linux" = {
          url = "https://github.com/surrealdb/surrealdb/releases/download/v3.0.1/surreal-v3.0.1.linux-arm64.tgz";
          hash = "sha256-SLB1QkRJ+iLsBbyH+n/rgOVHkooN/ioVD673SOJ0Xd0=";
        };
        "x86_64-darwin" = {
          url = "https://github.com/surrealdb/surrealdb/releases/download/v3.0.1/surreal-v3.0.1.darwin-amd64.tgz";
          hash = "sha256-hubHBsi78ef10U83rmakHS6KvNPsGv4G5oYISWfDvB8=";
        };
        "aarch64-darwin" = {
          url = "https://github.com/surrealdb/surrealdb/releases/download/v3.0.1/surreal-v3.0.1.darwin-arm64.tgz";
          hash = "sha256-wxh/SujqPhJRHCQfBOVgpzIM25JZj5EscWSYQCgS9bA=";
        };
      };
      src = sources.${pkgs.stdenv.hostPlatform.system}
        or (throw "Unsupported platform: ${pkgs.stdenv.hostPlatform.system}");
    in
    pkgs.stdenv.mkDerivation {
      pname = "surrealdb";
      version = "3.0.1";

      src = pkgs.fetchurl {
        inherit (src) url hash;
      };

      sourceRoot = ".";

      nativeBuildInputs = lib.optionals pkgs.stdenv.hostPlatform.isLinux [
        pkgs.autoPatchelfHook
      ];

      buildInputs = lib.optionals pkgs.stdenv.hostPlatform.isLinux [
        pkgs.gcc-unwrapped.lib
      ];

      installPhase = ''
        install -Dm755 surreal $out/bin/surreal
      '';
    };
in
{
  # --- Packages ---
  packages = [
    surrealdb-v3
    pkgs.curl # used for SurrealDB health checks
  ];

  # --- Node.js / npm ---
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22; # closest LTS in nixpkgs; Node 25 alpine is used in Docker
    npm = {
      enable = true;
      install.enable = true; # auto-runs `npm install` when package-lock.json changes
    };
  };

  # --- Environment variables ---
  env = {
    SURREALDB_PORT = "8000";
    SURREALDB_URL = "http://127.0.0.1:8000";
    SURREALDB_NAMESPACE = "summer";
    SURREALDB_DATABASE = "summer";
  };

  # --- Processes (started with `devenv up`) ---
  processes.surrealdb = {
    exec = ''
      mkdir -p "$DEVENV_STATE/surrealdb"
      exec surreal start \
        --log info \
        --bind 127.0.0.1:8000 \
        --unauthenticated \
        --allow-all \
        "surrealkv:$DEVENV_STATE/surrealdb"
    '';
  };

  processes.vite = {
    exec = "npx vite dev";
  };

  # --- Scripts (available in the devenv shell) ---
  scripts.dev.exec = ''
    # Start SurrealDB + Vite together (like the old dev.sh)
    devenv up
  '';

  scripts.db-cli.exec = ''
    surreal sql --conn http://127.0.0.1:8000 --ns summer --db summer
  '';

  scripts.summer-migrate.exec = ''
    node bin/migrate.js "$@"
  '';

  scripts.summer-backup.exec = ''
    node bin/backup.js "$@"
  '';

  scripts.summer-restore.exec = ''
    node bin/restore.js "$@"
  '';

  # --- Enter shell hook ---
  enterShell = ''
    echo "summer dev environment ready"
    echo ""
    echo "  devenv up     — start SurrealDB + Vite dev server"
    echo "  db-cli        — open SurrealDB SQL shell"
    echo "  npm run build — production build"
    echo "  npm run check — TypeScript check"
    echo "  npm run lint  — lint & format check"
    echo ""
    echo "Node $(node --version) | npm $(npm --version) | surreal $(surreal version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  '';
}
