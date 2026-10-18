# Epic: Files & storage

Browse and manage the server's files and disks from the browser: the file manager, file operations, the recycle bin, an editor, and disk management down to eject and format.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | File manager | Existing | existing |
| 6 | File operations | Slice 2 | planned |
| 7 | Upload & download | Slice 2 | planned |
| 8 | Recycle bin | Slice 2 | planned |
| 9 | Text editor | Slice 2 | planned |
| 10 | Disk management | Slice 2 · GA | planned |
| 11 | Format & partition | Slice 2 · GA | planned |
| 39 | File manager view modes | Slice 2 | planned |
| 40 | Drives view | Slice 2 | planned |
| 41 | File preview | Slice 2 | planned |

## Existing

### A. File manager · existing
Browse directories, search, sort, toggle hidden files, and Quick Look preview text files. The listing and preview come from server functions. code in `src/components/apps/app-files/`, `src/lib/files.ts`, `src/hooks/use-files.ts`.

## Slice 2: Server management core

### 6. File operations · needs a decision
Create folders, rename, move, copy, and delete entries from the file manager, including dragging an entry onto a folder, so it becomes a real file tool and not just a viewer.

**Done when:** each operation runs against the real filesystem, the list updates without a manual refresh, and failures (permissions, collisions) show a clear error and change nothing.
- [ ] Design it (spec): `/architect file operations`

### 7. Upload & download · needs a decision
Move files on and off the server through the browser, including multi file upload and large file handling.

**Done when:** you can upload one or many files into the current folder and download a selected file, with progress and errors visible.
- [ ] Design it (spec): `/architect upload & download`

### 8. Recycle bin
Deleting moves entries to a recycle bin you can browse, restore from, or empty, so a misclick is recoverable.

**Done when:** deleted items leave the listing, appear in the recycle bin, and can be restored to their original path or permanently removed.
- [ ] Develop it: `/develop recycle bin`

### 9. Text editor
Open and edit text and config files in place, then save, so you do not need a separate tool for small server changes.

**Done when:** a text file opens in an editor, edits save back to disk, and unsaved changes warn before you leave.
- [ ] Develop it: `/develop text editor`

### 10. Disk management · GA · needs a decision
See every disk and partition, mount and unmount, and safely eject removable drives.

**Done when:** disks and partitions are listed with their state, mount and unmount work, and eject confirms the target and refuses unsafe removal.
- [ ] Design it (spec): `/architect disk management`

### 11. Format & partition · GA · needs a decision
Format drives and create or resize partitions from the browser, with heavy guardrails because this destroys data.

**Done when:** a disk can be partitioned and formatted after an explicit, typed confirmation, and a wrong or unsafe target is refused.
- [ ] Design it (spec): `/architect format & partition`

### 39. File manager view modes
Switch the file listing between list, grid, and column arrangements, so browsing suits the task and the screen.

**Done when:** list, grid, and column views render the same entries, the chosen view is remembered between sessions, and sorting and selection work in all three.
- [ ] Develop it: `/develop file manager view modes`

### 40. Drives view
A landing view that lists every disk with its name, capacity, and used space and opens a disk's contents when clicked, the way "This PC" does.

**Done when:** each mounted disk shows its name, size, and used space, and selecting one opens its folder in the file manager.
- [ ] Develop it: `/develop drives view`

### 41. File preview
Preview images, media, and documents inline, not only text, so you can check a file without leaving the desktop.

**Done when:** images and other supported types preview inline, an unsupported type shows a clear fallback, and Escape closes the preview.
- [ ] Develop it: `/develop file preview`

## Deferred

- **File share links**: generate a temporary link to share a file · needs a decision
- **SMB / NFS share management**: create and manage network shares from opess · needs a decision · GA
