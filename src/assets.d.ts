declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const dataUrl: string;
  export default dataUrl;
}
