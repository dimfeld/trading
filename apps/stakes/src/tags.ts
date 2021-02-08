import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@sveltestack/svelte-query';
import { mutationOptions, optimisticUpdateCollectionMember } from './mutations';
import { getNotificationsContext } from 'svelte-notifications';
import ky from './ssr-ky';
import { arrayToObject } from './query';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export function initTagsQuery(initialData: Record<string, Tag>) {
  let client = useQueryClient();
  client.setQueryData('tags', initialData);
  client.setQueryDefaults('tags', {
    select: arrayToObject,
  });
}

export function tagsQuery() {
  return useQuery<Record<string, Tag>>('tags');
}

export function updateTagMutation() {
  let notifications = getNotificationsContext();
  return useMutation(
    (tag: Tag) => ky.put(`/api/tags/${tag.id}`, { json: tag }).json<Tag>(),
    mutationOptions({
      notifications,
      optimisticUpdates: (client: QueryClient, tag: Tag) =>
        Promise.all([optimisticUpdateCollectionMember(client, 'tags', tag)]),
    })
  );
}

export function createTagMutation() {
  let notifications = getNotificationsContext();
  return useMutation(
    (tag: Omit<Tag, 'id'>) => ky.post(`/api/tags`, { json: tag }).json<Tag>(),
    mutationOptions({
      notifications,
    })
  );
}
