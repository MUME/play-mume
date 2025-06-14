// utils.ts
export function throttle<T extends (...args: unknown[]) => unknown>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    const remainingTime = delay - (now - lastCallTime);

    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (remainingTime <= 0) {
      // If no cooldown or cooldown has passed, call immediately
      lastCallTime = now;
      func.apply(this, args);
    } else {
      // Otherwise, schedule the call for after the remaining cooldown
      lastArgs = args; // Store the latest arguments
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null; // Clear stored arguments after execution
        }
        timeoutId = null;
      }, remainingTime);
    }
  };
}
