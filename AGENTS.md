# Native Library Development Guidelines

Native modules should be thin bindings over the platform APIs they expose. Keep
native code close to the operating-system or vendor API, and keep
public-facing library behavior in TypeScript.

## Native Boundary

- Expose native capabilities directly and with names that match the underlying
  platform concepts where practical.
- Native modules should manage platform handles, resource lifetimes, callbacks,
  and minimum validation required to call the platform API safely.
- Native modules should return raw platform-shaped data and errors where
  practical, including native status codes or operation names when available.
- Do not implement public API translation, event names, capability
  normalization, or library-specific error classes in native code.
- Do not add user-facing convenience behavior to native code unless it is
  required for safety or correctness at the native API boundary.

## TypeScript Boundary

- TypeScript modules own the public library API.
- TypeScript should translate platform concepts into public concepts such as
  support information, events, state changes, and standard error classes.
- TypeScript should maintain public-facing state and compute derived changes
  from raw native data.
- TypeScript should convert native failures into public error classes.
- TypeScript should guard object lifecycle state, including rejecting or
  throwing when callers use closed, disposed, or otherwise invalid objects.
- Prefer Node's `EventEmitter` for Node library event-listener APIs unless the
  package has a clear reason to use a different event primitive.
- Prefer functions, factory functions, and object composition over classes
  unless a class materially improves the API or implementation.
- Public state objects should be immutable. Use `Object.freeze()` when creating
  returned state and preserve object identity for unchanged values.
- State updates should be functional: reuse unchanged nested objects and arrays,
  and allocate a new parent object only when a child value has changed.

## Threading And Blocking

- Do not block the JavaScript thread for native operations that can wait on the
  operating system, device drivers, run loops, external hardware, or other
  processes.
- Prefer promises for native operations that may take time or fail
  asynchronously.
- Use thread-safe native callbacks for platform notifications and data delivery.
- If a native operation must remain synchronous because the platform API is
  effectively immediate, keep the operation small and document that assumption
  near the binding.

## Notifications

- Expose platform notifications where the operating system supports them.
- Native notifications should report platform-shaped facts only.
- TypeScript should translate those notifications into public events and should
  read fresh native state before emitting derived public events.
- When a native resource disappears or is invalidated externally, TypeScript
  should mark affected public wrapper objects as closed or invalid and emit the
  relevant lifecycle event exactly once where the public API supports it.

## Tests

- Prefer repeatable tests over ad-hoc smoke scripts.
- Tests that require platform APIs, hardware, virtual devices, or other
  machine-specific capabilities should live behind explicit integration scripts.
- Tests should cover both local wrapper lifecycle behavior and lifecycle changes
  caused by native resources disappearing or becoming invalid externally.
