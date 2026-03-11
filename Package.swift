// swift-tools-version:5.3

import Foundation
import PackageDescription

var sources = ["src/parser.c"]
if FileManager.default.fileExists(atPath: "src/scanner.c") {
    sources.append("src/scanner.c")
}

let package = Package(
    name: "TreeSitterMlir",
    products: [
        .library(name: "TreeSitterMlir", targets: ["TreeSitterMlir"]),
    ],
    dependencies: [
        .package(name: "SwiftTreeSitter", url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.9.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterMlir",
            dependencies: [],
            path: ".",
            sources: sources,
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterMlirTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterMlir",
            ],
            path: "bindings/swift/TreeSitterMlirTests"
        )
    ],
    cLanguageStandard: .c11
)
