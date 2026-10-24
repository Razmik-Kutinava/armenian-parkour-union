<script lang="ts">
	import Avatar from '#lib/components/site/Avatar.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 4.6: coaches and judges; card — photo, name, category, description. */
	let { data }: PageProps = $props();
	const sections = $derived([
		{ id: 'team-trainers', title: t('team.trainers'), people: data.trainers },
		{ id: 'team-judges', title: t('team.judges'), people: data.judges }
	]);
</script>

<SeoHead seo={data.seo} />

<div class="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('team.title')}</h1>

	{#each sections as section (section.id)}
		<section class="flex flex-col gap-5" aria-labelledby={section.id}>
			<h2 id={section.id} class="text-2xl font-bold text-ink-900">{section.title}</h2>
			{#if section.people.length === 0}
				<p class="text-ink-700">{t('team.empty')}</p>
			{:else}
				<ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{#each section.people as person, i (i)}
						<li class="flex gap-4 rounded-md border border-line bg-surface p-5">
							<Avatar name={person.name} url={person.photoUrl} class="size-16 text-xl" />
							<div class="flex min-w-0 flex-col gap-1">
								<p class="font-bold text-ink-900">{person.name}</p>
								{#if person.category}
									<p class="text-sm text-ink-700">{person.category}</p>
								{/if}
								{#if person.bio}
									<p class="mt-1 text-sm whitespace-pre-line text-ink-700">{person.bio}</p>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>
