import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@sveltestack/svelte-query';
import { mutationOptions } from './mutations';
import ky from './ssr-ky';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export function initTagsQuery(initialData: Record<string, Tag>) {
  let client = useQueryClient();
  client.setQueryDefaults('tags', { initialData });
}

export function tagsQuery() {
  return useQuery<Record<string, Tag>>('tags');
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
