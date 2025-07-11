export function formatFileNameAsTitle(fileName: string): string {
  // Example implementation: remove file extension and capitalize words
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
  const withSpaces = withoutExtension
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])(A-Z)/g, "$1 $2");
  return withSpaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim();
}
