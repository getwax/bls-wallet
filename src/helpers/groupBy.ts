type Group<T, M> = {
  measure: M;
  elements: T[];
};

export default function groupBy<T, M extends (element: T) => unknown>(
  elements: T[],
  Measure: M,
  measuresEqual: (a: ReturnType<M>, b: ReturnType<M>) => boolean,
): Group<T, ReturnType<M>>[] {
  if (elements.length === 0) {
    return [];
  }

  type G = Group<T, ReturnType<M>>;

  const firstElement = elements[0];
  const groups: G[] = [];

  let currentGroup: G = {
    measure: Measure(firstElement) as ReturnType<M>,
    elements: [firstElement],
  };

  for (let i = 1; i < elements.length; i++) {
    const element = elements[i];
    const measure = Measure(element) as ReturnType<M>;

    if (measuresEqual(measure, currentGroup.measure)) {
      currentGroup.elements.push(element);
    } else {
      groups.push(currentGroup);

      currentGroup = {
        measure,
        elements: [element],
      };
    }
  }

  groups.push(currentGroup);

  return groups;
}
