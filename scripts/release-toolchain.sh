#!/usr/bin/env bash
set -euo pipefail

# Pack lifecycle scripts run in a new shell, so expose the pinned SDK through
# Node's existing bin directory as well as the build shell.
sdk="${RUNNER_TEMP:?}/libopus-emsdk"
git clone https://github.com/emscripten-core/emsdk.git "$sdk"
git -C "$sdk" checkout --detach 35ff8a6d150541276abbc6bae512ca90bcfbe220
"$sdk/emsdk" install 6.0.10
"$sdk/emsdk" activate 6.0.10
bin_dir="$(dirname "$(command -v node)")"
for tool in emcc em++ emar emranlib emconfigure emmake; do
  test ! -e "$bin_dir/$tool"
  printf '#!/usr/bin/env bash\nset -e\nsource %q >/dev/null 2>&1\nexec %q "$@"\n' \
    "$sdk/emsdk_env.sh" "$sdk/upstream/emscripten/$tool" > "$sdk/$tool-wrapper"
  sudo install -m 755 "$sdk/$tool-wrapper" "$bin_dir/$tool"
done
emcc --version
