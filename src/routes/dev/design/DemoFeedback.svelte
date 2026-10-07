<script lang="ts">
	import Inbox from '@lucide/svelte/icons/inbox';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import Skeleton from '#lib/components/ui/Skeleton.svelte';
	import Tabs from '#lib/components/ui/Tabs.svelte';
	import Toaster from '#lib/components/ui/Toaster.svelte';
	import { showToast } from '#lib/components/ui/toast.svelte.ts';

	let modalOpen = $state(false);
	const tabs = [
		{ id: 'events', label: 'Միջոցառումներ' },
		{ id: 'news', label: 'Новости' },
		{ id: 'certificates', label: 'Certificates' }
	];
</script>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-4 rounded-md bg-surface p-6 shadow-sm">
		<h3 class="text-xl font-bold">Badge</h3>
		<div class="flex flex-wrap gap-3">
			<Badge tone="success">Paid</Badge>
			<Badge tone="warning">Pending review</Badge>
			<Badge tone="error">Rejected</Badge>
			<Badge tone="info">Draft</Badge>
			<Badge tone="neutral">Archived</Badge>
			<Badge tone="accent">Հրապարակված</Badge>
		</div>
	</div>

	<div class="flex flex-col gap-4 rounded-md bg-surface p-6 shadow-sm">
		<h3 class="text-xl font-bold">Modal and Toast</h3>
		<div class="flex flex-wrap gap-3">
			<Button onclick={() => (modalOpen = true)}>Open modal</Button>
			<Button variant="secondary" onclick={() => showToast('success', 'Changes saved')}
				>Success toast</Button
			>
			<Button variant="secondary" onclick={() => showToast('info', 'Registration opens on Monday')}
				>Info toast</Button
			>
			<Button variant="danger" onclick={() => showToast('error', 'Payment failed. Try again.')}
				>Error toast (stays)</Button
			>
		</div>
	</div>

	<div class="rounded-md bg-surface p-6 shadow-sm">
		<h3 class="mb-4 text-xl font-bold">Tabs (arrows, Home, End)</h3>
		<Tabs {tabs} label="Profile sections">
			{#snippet panel(active)}
				<p class="text-ink-700">Panel: {active}</p>
			{/snippet}
		</Tabs>
	</div>

	<div class="grid gap-6 md:grid-cols-2">
		<div class="flex flex-col gap-3 rounded-md bg-surface p-6 shadow-sm">
			<h3 class="text-xl font-bold">Skeleton</h3>
			<div class="flex items-center gap-3">
				<Skeleton class="size-10 rounded-full" />
				<div class="flex flex-1 flex-col gap-2">
					<Skeleton class="h-4 w-2/3" />
					<Skeleton class="h-4 w-1/3" />
				</div>
			</div>
			<Skeleton class="aspect-video w-full rounded-md" />
		</div>
		<EmptyState
			icon={Inbox}
			title="No registrations yet"
			text="Events you register for will appear here."
		>
			{#snippet action()}<Button>Browse events</Button>{/snippet}
		</EmptyState>
	</div>
</div>

<Modal bind:open={modalOpen} title="Cancel registration?">
	<p class="text-ink-700">Your place will be released. Points for registration will be reversed.</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (modalOpen = false)}>Keep</Button>
		<Button variant="danger" onclick={() => (modalOpen = false)}>Cancel registration</Button>
	{/snippet}
</Modal>
<Toaster />
