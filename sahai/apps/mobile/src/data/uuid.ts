/**
 * Pure-JS UUID v4 generator.
 *
 * We don't rely on `crypto.randomUUID` because it isn't guaranteed in
 * all React Native runtimes. Math.random is sufficient for client-side
 * patient/visit ids — collisions are astronomically unlikely.
 */

export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
