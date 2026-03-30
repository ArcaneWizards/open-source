export type TreeLeaf<T> = {
  value: T;
  children?: undefined;
};

export type TreeNode<T> = {
  value?: T;
  children: Record<string, Tree<T>>;
};

export type Tree<T> = TreeLeaf<T> | TreeNode<T>;

export const isTreeNode = <T>(node: Tree<T>): node is TreeNode<T> =>
  'children' in node &&
  typeof node.children === 'object' &&
  node.children !== null;

export const updateTreeState = <T>(
  current: Tree<T>,
  path: string[],
  value: T,
): Tree<T> => {
  if (path.length === 0) {
    return {
      ...current,
      value,
    };
  }
  const [nextKey, ...remainingPath] = path;
  if (!nextKey) {
    throw new Error('Invalid path');
  }
  if (remainingPath.length === 0) {
    // Update the child directly
    return {
      ...current,
      children: {
        ...current.children,
        [nextKey]: {
          value,
          children: current.children?.[nextKey]?.children,
        },
      },
    };
  }
  // Path is not empty, need to recurse
  const children = isTreeNode(current) ? current.children : {};
  return {
    ...current,
    children: {
      ...children,
      [nextKey]: updateTreeState(
        children[nextKey] ?? { children: {} },
        remainingPath,
        value,
      ),
    },
  };
};

export const getTreeValue = <T>(current: Tree<T>, path: string[]): T | null => {
  if (path.length === 0) {
    return current.value ?? null;
  }
  const [nextKey, ...remainingPath] = path;
  if (!nextKey) {
    throw new Error('Invalid path');
  }
  if (isTreeNode(current)) {
    return getTreeValue(
      current.children[nextKey] ?? { children: {} },
      remainingPath,
    );
  }
  return null;
};

export const deleteTreePath = <T>(
  current: Tree<T>,
  path: string[],
): Tree<T> => {
  if (path.length === 0) {
    throw new Error('Cannot delete root of the tree');
  }
  const [nextKey, ...remainingPath] = path;
  if (!nextKey) {
    throw new Error('Invalid path');
  }
  if (isTreeNode(current)) {
    if (remainingPath.length === 0) {
      // Delete the child directly
      const { [nextKey]: _, ...remainingChildren } = current.children;
      return {
        ...current,
        children: remainingChildren,
      };
    } else {
      // Recurse into the child
      return {
        ...current,
        children: {
          ...current.children,
          [nextKey]: deleteTreePath(
            current.children[nextKey] ?? { children: {} },
            remainingPath,
          ),
        },
      };
    }
  }
  return current;
};

export const mapTree = <T, U>(
  current: Tree<T>,
  fn: (value: T) => U,
): Tree<U> => {
  if (isTreeNode(current)) {
    return {
      value: current.value ? fn(current.value) : undefined,
      children: Object.fromEntries(
        Object.entries(current.children).map(([key, child]) => [
          key,
          mapTree(child, fn),
        ]),
      ),
    };
  } else {
    return {
      value: fn(current.value),
    };
  }
};
