<script lang="ts">
	import Inbox from '@lucide/svelte/icons/inbox';
	import { page } from '$app/state';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import DataTable, { type Column } from '#lib/components/admin/DataTable.svelte';
	import FilterBar from '#lib/components/admin/FilterBar.svelte';
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import RichTextEditor from '#lib/components/admin/RichTextEditor.svelte';
	import { readListState } from '#lib/components/admin/list-state.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Input from '#lib/components/ui/Input.svelte';

	/* Demo only (/dev/design is 404 in production): sample rows for the admin building blocks. */
	const rows = [
		{ id: '1', name: 'Anna Petrosyan', role: 'editor', joined: '2026-09-01' },
		{ id: '2', name: 'Davit Hakobyan', role: 'member', joined: '2026-09-14' },
		{ id: '3', name: 'Mariam Sargsyan', role: 'moderator', joined: '2026-10-02' }
	];
	const columns: Column[] = [
		{ key: 'name', label: 'Name', sortable: true },
		{ key: 'role', label: 'Role' },
		{ key: 'joined', label: 'Joined', sortable: true, class: 'whitespace-nowrap' }
	];
	const listState = $derived(
		readListState(page.url.searchParams, {
			sortable: ['name', 'joined'],
			filters: ['role'],
			defaultSort: { key: 'joined', dir: 'desc' }
		})
	);
	const roles = ['member', 'editor', 'moderator'].map((r) => ({ value: r, label: r }));
	let selected: string[] = $state([]);
	let confirmOpen = $state(false);
</script>

<div class="flex flex-col gap-8">
	<h3 class="text-2xl font-bold">Admin: FilterBar, DataTable, Pagination</h3>
	<FilterBar
		filters={[{ key: 'role', label: 'Role', options: roles }]}
		state={listState}
		searchLabel="Search"
	/>
	<DataTable {rows} {columns} caption="Users" state={listState} selectable bind:selected>
		{#snippet cell(row, column)}{row[column.key as keyof typeof row]}{/snippet}
		{#snippet empty()}<EmptyState icon={Inbox} title="Nothing here" />{/snippet}
	</DataTable>
	<p class="text-sm text-ink-700">Selected: {selected.join(', ') || '—'}</p>
	<Pagination total={70} current={listState.page} />
	<DataTable rows={[]} {columns} caption="Empty">
		{#snippet cell()}{/snippet}
		{#snippet empty()}<EmptyState
				icon={Inbox}
				title="No users yet"
				text="Create the first one."
			/>{/snippet}
	</DataTable>

	<h3 class="text-2xl font-bold">Admin: FormLayout, ConfirmDialog</h3>
	<FormLayout cancelHref="/dev/design" action="?/none" onsubmit={(e) => e.preventDefault()}>
		<FormSection title="Main" text="Section with a heading, labels on top.">
			<Input label="Title" name="title" />
			<RichTextEditor
				label="Text"
				name="body"
				value="<h2>Heading</h2><p>Some <strong>bold</strong> text.</p>"
			/>
		</FormSection>
		<FormSection title="Contacts"><Input label="Email" name="email" type="email" /></FormSection>
	</FormLayout>
	<div><Button variant="danger" onclick={() => (confirmOpen = true)}>Block user…</Button></div>
	<ConfirmDialog
		bind:open={confirmOpen}
		title="Block user?"
		text="The user is signed out at once and cannot log in until unblocked."
		action="?/none"
		confirmLabel="Block"
		danger
		comment="required"
	/>
</div>
