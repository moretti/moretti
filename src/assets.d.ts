// Bun inlines these as data URLs at build time (see scripts/build.ts).
declare module "*.png" {
  const url: string;
  export default url;
}
declare module "*.mp3" {
  const url: string;
  export default url;
}
