#!/usr/bin/env bash
# Local Android build for AdiV mobile, running inside WSL.
#
# The mobile app imports outside its folder (../../../convex/_generated and
# ../../../lib/...), so the build tree must mirror the repo layout:
#   ~/adiv-build/convex  (root convex incl. _generated)
#   ~/adiv-build/lib     (root lib: reminders, achievements, ...)
#   ~/adiv-build/mobile  (the Expo app; node_modules reused across runs)
#
# Requires: JDK 17, bun, Android SDK at ~/android-sdk.
set -e

REPO="/mnt/c/Users/Damascus/Documents/code ni cris/AdiV"
BUILD="$HOME/adiv-build"

mkdir -p "$BUILD"

# Reuse the prepared mobile tree (node_modules intact) from earlier runs
if [ -d "$HOME/adiv-mobile" ] && [ ! -d "$BUILD/mobile" ]; then
  mv "$HOME/adiv-mobile" "$BUILD/mobile"
fi
if [ ! -d "$BUILD/mobile" ]; then
  mkdir -p "$BUILD/mobile"
  tar -C "$REPO/mobile" --exclude=node_modules --exclude=.expo --exclude=builds --exclude=android -cf - . | tar -C "$BUILD/mobile" -xf -
  cd "$BUILD/mobile"
  echo "=== bun install..."
  bun install > /tmp/bun-install.log 2>&1
  echo "bun install OK"
fi

# Root backend + shared lib, laid out exactly like the repo so the
# ../../../ imports resolve
echo "=== Copying root convex/ and lib/..."
rm -rf "$BUILD/convex" "$BUILD/lib"
cp -r "$REPO/convex" "$BUILD/convex"
cp -r "$REPO/lib" "$BUILD/lib"
# Root package.json declares "workspaces": ["mobile"] - Expo CLI needs it to
# detect the monorepo root so Metro resolves paths outside mobile/
cp "$REPO/package.json" "$BUILD/package.json"

if grep -q "adminMigration" "$BUILD/convex/_generated/api.d.ts" 2>/dev/null; then
  echo "WARNING: _generated api still references adminMigration - regenerate on Windows first"
  exit 1
fi

cd "$BUILD/mobile"
export ANDROID_HOME="$HOME/android-sdk"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

if [ ! -d android ]; then
  echo "=== expo prebuild -p android..."
  bunx expo prebuild -p android --no-install > /tmp/prebuild.log 2>&1
  echo "prebuild OK"
fi

echo "=== gradle assembleRelease (this takes a while)..."
cd android
./gradlew assembleRelease --no-daemon > /tmp/gradle-build.log 2>&1 || {
  echo "GRADLE FAILED - tail of log:"
  grep -n -A10 "What went wrong" /tmp/gradle-build.log | head -30
  exit 1
}
echo "=== BUILD OK"
ls -lh app/build/outputs/apk/release/
