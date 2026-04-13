// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "TreeSitterMlir",
    platforms: [.macOS(.v10_13), .iOS(.v11)],
    products: [
        .library(name: "TreeSitterMlir", targets: ["TreeSitterMlir"]),
    ],
    dependencies: [],
    targets: [
        .target(name: "TreeSitterMlir",
                path: ".",
                exclude: [
                    "Cargo.toml",
                    "Cargo.lock",
                    "Makefile",
                    "binding.gyp",
                    "bindings/c",
                    "bindings/go",
                    "bindings/node",
                    "bindings/python",
                    "bindings/rust",
                    "bindings/README.md",
                    "prebuilds",
                    "grammar.js",
                    "package.json",
                    "package-lock.json",
                    "pyproject.toml",
                    "setup.py",
                    "bench.mjs",
                    "renovate.json",
                    "tree-sitter.json",
                    "scripts",
                    "test",
                    "examples",
                    ".editorconfig",
                    ".github",
                    ".gitignore",
                    ".gitattributes",
                    ".gitmodules",
                ],
                sources: [
                    "src/parser.c",
                    // NOTE: if your language has an external scanner, add it here.
                ],
                resources: [
                    .copy("queries")
                ],
                publicHeadersPath: "bindings/swift",
                cSettings: [.headerSearchPath("src")])
    ],
    cLanguageStandard: .c11
)
