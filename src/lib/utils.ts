export async function sleep (
  ms : number = 500
) : Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (
    k: infer I
  ) => void
  ? I
  : never;

type ClassType = new (...args: any[]) => any;

export function Mixin<T extends ClassType, R extends T[]>(...classRefs: [...R]):
  new (...args: any[]) => UnionToIntersection<InstanceType<[...R][number]>> {
  return merge(class { }, ...classRefs);
}

function merge(derived: ClassType, ...classRefs: ClassType[]) {
  classRefs.forEach(classRef => {
    Object.getOwnPropertyNames(classRef.prototype).forEach(name => {
      // you can get rid of type casting in this way
      const descriptor = Object.getOwnPropertyDescriptor(classRef.prototype, name)
      if (name !== 'constructor' && descriptor) {
        Object.defineProperty(
          derived.prototype,
          name,
          descriptor
        );
      }
    });
  });

  return derived;
}
