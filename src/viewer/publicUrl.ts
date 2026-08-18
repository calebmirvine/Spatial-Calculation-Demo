/** Root-relative public path that still works on GitHub project Pages. */
export function publicUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
