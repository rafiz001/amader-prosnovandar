export const SUBJECT_TABS = ['questions', 'chapters', 'types'];

const PAGE_ROUTES = new Set(['institute', 'classes', 'generate', 'papers', 'backup']);

export function parseHash(hash = window.location.hash) {
  const raw = (hash || '').replace(/^#/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'institute', path: '/institute' };

  const [first, second, third, fourth, fifth] = parts;

  if (parts.length === 1 && PAGE_ROUTES.has(first)) {
    return { name: first, path };
  }
  if (first === 'classes' && parts.length === 2) {
    return { name: 'class', id: second, path };
  }
  if (
    first === 'classes' &&
    (parts.length === 4 || parts.length === 5) &&
    third === 'subjects' &&
    (!fifth || SUBJECT_TABS.includes(fifth))
  ) {
    return {
      name: 'subject',
      id: fourth,
      classId: second,
      tab: fifth || 'questions',
      path,
    };
  }
  if (
    first === 'subjects' &&
    (parts.length === 2 || parts.length === 3) &&
    (!third || SUBJECT_TABS.includes(third))
  ) {
    return { name: 'subject', id: second, tab: third || 'questions', path };
  }

  return { name: 'notFound', path };
}

export function pathFor(item, current) {
  if (PAGE_ROUTES.has(item.name)) return `/${item.name}`;
  if (item.name === 'class') return `/classes/${item.id}`;
  if (item.name === 'subject') {
    const classId =
      current?.name === 'class' ? current.id : current?.name === 'subject' ? current.classId : null;
    return classId ? `/classes/${classId}/subjects/${item.id}` : `/subjects/${item.id}`;
  }
  return '/institute';
}

export function buildCrumbs(route, labels) {
  const classes = { name: 'classes', label: 'শ্রেণিসমূহ', path: '/classes' };
  const current = (name, id) => ({
    name,
    id,
    label: labels[route.path] || (name === 'class' ? 'শ্রেণি' : 'বিষয়'),
    path: route.path,
  });

  switch (route.name) {
    case 'institute':
      return [{ name: 'institute', label: 'প্রতিষ্ঠান', path: '/institute' }];
    case 'classes':
      return [classes];
    case 'class':
      return [classes, current('class', route.id)];
    case 'subject': {
      const crumbs = [classes];
      if (route.classId) {
        crumbs.push({
          name: 'class',
          id: route.classId,
          label: labels[`/classes/${route.classId}`] || 'শ্রেণি',
          path: `/classes/${route.classId}`,
        });
      }
      crumbs.push(current('subject', route.id));
      return crumbs;
    }
    case 'generate':
      return [{ name: 'generate', label: 'প্রশ্নপত্র তৈরি', path: '/generate' }];
    case 'papers':
      return [{ name: 'papers', label: 'প্রশ্নপত্রসমূহ', path: '/papers' }];
    case 'backup':
      return [{ name: 'backup', label: 'ব্যাকআপ ও পুনরুদ্ধার', path: '/backup' }];
    default:
      return [{ name: 'notFound', label: 'পৃষ্ঠা পাওয়া যায়নি', path: route.path || '/' }];
  }
}
