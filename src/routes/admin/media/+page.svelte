<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import Images from '@lucide/svelte/icons/images';
	import FilterBar from '#lib/components/admin/FilterBar.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { mediaKinds } from '#lib/validation/media.ts';
	import { formatSize } from './format';
	import Uploader from './Uploader.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 20: thumbnail grid, search by name, filter by type. */
	let { data }: PageProps = $props();
	const filters = $derived([
		{
			key: 'kind',
			label: t('media.filter.kind'),
			options: mediaKinds.map((k) => ({ value: k, label: t(`media.kind.${k}`) }))
		}
	]);
</script>

<svelte:head><title>{t('admin.nav.media')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.media')}</h1>

<Uploader />

<FilterBar {filters} state={data.state} searchLabel={t('media.search')} />

{#if data.rows.length === 0}
	<EmptyState icon={Images} title={t('media.empty')} />
{:else}
	<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
		{#each data.rows as file (file.id)}
			<li class="flex flex-col overflow-hidden rounded-md border border-line bg-surface">
				<div class="flex aspect-square items-center justify-center bg-navy-100">
					{#if file.url && file.mime.startsWith('image/')}
						<img
							src={file.url}
							alt={file.alt?.en ?? ''}
							loading="lazy"
							class="size-full object-cover"
						/>
					{:else}
						<FileText class="size-10 text-navy-700" aria-hidden="true" />
					{/if}
				</div>
				<div class="flex flex-col gap-1 p-3 text-sm">
					<a
						href="/admin/media/{file.id}"
						class="font-bold break-all text-navy-700 underline-offset-2 hover:underline"
						>{file.originalName}</a
					>
					<span class="text-ink-700">{formatSize(file.sizeBytes)}</span>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<div class="mt-4"><Pagination total={data.total} current={data.state.page} /></div>
