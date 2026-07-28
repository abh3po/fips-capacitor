import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/plugin.cjs.js",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "dist/plugin.js",
      format: "iife",
      name: "FipsCapacitorPlugin",
      sourcemap: true,
      globals: {
        "@capacitor/core": "capacitorExports",
      },
    },
  ],
  external: ["@capacitor/core"],
  plugins: [typescript()],
};
