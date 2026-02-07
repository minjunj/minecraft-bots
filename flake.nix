{
	description = "Mineflayer bot flake";
	inputs = {
		nixpkgs.url = "github:NixOS/nixpkgs";
		flake-utils.url = "github:numtide/flake-utils";
	};
	outputs = { self, nixpkgs, flake-utils, ... }:
		flake-utils.lib.eachDefaultSystem (system: let
			pkgs = import nixpkgs { inherit system; };
		in {
			devShell = pkgs.mkShell {
				buildInputs = [
					pkgs.nodejs_22
					pkgs.pkg-config
					pkgs.cairo
					pkgs.pango
					pkgs.libjpeg
					pkgs.giflib
					pkgs.librsvg
					pkgs.util-linux
					pkgs.freetype
					pkgs.fontconfig
					pkgs.pixman
					pkgs.glib
					pkgs.harfbuzz
				];
				shellHook = ''
					export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [
						pkgs.cairo
						pkgs.pango
						pkgs.libjpeg
						pkgs.giflib
						pkgs.librsvg
						pkgs.util-linux
						pkgs.freetype
						pkgs.fontconfig
						pkgs.pixman
						pkgs.glib
						pkgs.harfbuzz
					]}:$LD_LIBRARY_PATH"
					echo "Welcome to the Mineflayer bot dev shell!"
				'';
			};
		});
}
