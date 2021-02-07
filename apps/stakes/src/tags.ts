import { useMutation, useQuery } from '@sveltestack/svelte-query';
import { getContext, setContext } from 'svelte';
import { mutationOptions } from './mutations';
import ky from './ssr-ky';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export function createTagsQuery(initialData: Record<string, Tag>) {
  let q = useQuery<Record<string, Tag>>('tags', { initialData });
  setContext('tags', q);
  return q;
}

export function tagsQuery() {
  return getContext<ReturnType<typeof createTagsQuery>>('tags');
}

export function updateTagMutation() {
  return useMutation(
    (tag: Tag) => ky.put(`/api/tags/${tag.id}`, { json: tag }).json<Tag>(),
    mutationOptions({ optimisticUpdateKey: ['tags'] })
  );
}

export function createTagMutation() {
  return useMutation((tag: Omit<Tag, 'id'>) =>
    ky.post(`/api/tags`, { json: tag }).json<Tag>()
  );
}
