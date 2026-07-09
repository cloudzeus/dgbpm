# Οργανόγραμμα Builder — Design Spec

**Ημερομηνία:** 2026-07-09
**Κατάσταση:** Εγκεκριμένο design (brainstorming) → προς implementation planning

## Σκοπός

Ένα ενοποιημένο, drag-and-drop εργαλείο όπου ο admin στήνει οπτικά:
1. τη **δεντροειδή ιεραρχία τμημάτων** (Departments),
2. τις **θέσεις εργασίας** ανά τμήμα (JobPositions),
3. την **ανάθεση χρηστών** σε κάθε θέση (UserPositions),
4. τον **προϊστάμενο** ανά θέση (JobPosition.managerId).

Αντικαθιστά/συμπληρώνει τις υπάρχουσες σελίδες λίστας `/departments` και `/positions` με μία οπτική εμπειρία. Οι υπάρχουσες σελίδες παραμένουν διαθέσιμες (fallback CRUD).

## Data model (υπάρχον — καμία αλλαγή schema)

- `Department` — `id, name, email?, phoneNumber?, parentId?, color(#hex)`, self-relation `DepartmentHierarchy`.
- `JobPosition` — `id, name, departmentId, managerId?` (manager = User).
- `UserPosition` — join `userId ↔ positionId`, `@@unique([userId, positionId])`.
- `User` — χωρίς πεδίο φωτό → avatars = **αρχικά σε χρωματιστό κύκλο** (deterministic color από το userId). Επέκταση με `image` αργότερα, χωρίς αλλαγή UI.

## Layout — τρεις ζώνες (Combination A+B)

```
┌─ Toolbar: ＋Τμήμα · zoom −/＋ · Fit · [👥 Ανάθεση χρηστών ▾] · save-status ──┐
├──────────────────────────────┬───────────────────────────────────────────┤
│  CANVAS (κυρίαρχος)           │  DETAIL PANEL (επιλεγμένο τμήμα)           │
│  Κάθετο δέντρο ΟΛΩΝ των       │  breadcrumb · λίστα θέσεων (expandable)    │
│  τμημάτων, γραμμές σύνδεσης,  │  ανά θέση: Προϊστάμενος (1) + Υπάλληλοι(ν) │
│  zoom/pan/fit.               │  avatars, drop-zone, ＋picker             │
│  drag κουτί → αλλαγή γονέα    │  ＋ Νέα θέση                               │
└──────────────────────────────┴───────────────────────────────────────────┘
        Users pool = drawer, ανοίγει από το "👥 Ανάθεση χρηστών ▾"
```

### 1. Canvas (αριστερά, πρωταγωνιστής)
- Δείχνει **πάντα ολόκληρο το δέντρο** όλων των τμημάτων (top-down, root = κόκκινη ακίδα DG-Red).
- Κάθε κόμβος: όνομα τμήματος, ουδέτερο λευκό κουτί με **αριστερή χρωματιστή ακίδα = `Department.color`**, μετρητές (# θέσεων, stacked avatars χρηστών).
- **Drag κόμβου πάνω σε άλλο** = αλλαγή γονέα (`parentId`). Drop στο κενό = root-level.
- Zoom −/＋, pan, **Fit-to-screen** για μεγάλα οργανογράμματα.
- Επιλεγμένο τμήμα: κόκκινο ring (selected state).
- `＋ Τμήμα` δημιουργεί νέο τμήμα (child του επιλεγμένου, ή root).

### 2. Detail panel (δεξιά)
- Ενεργό για το επιλεγμένο τμήμα· breadcrumb «Γονέας › Τμήμα», inline μετονομασία, μενού ⋯ (edit meta/color/email/phone, delete).
- **Θέσεις εργασίας** ως **expandable** κάρτες:
  - **Κλειστή:** όνομα θέσης + stacked avatars σύνοψης.
  - **Ανοιχτή:** ενότητα **Προϊστάμενος** (μονή επιλογή, avatar + όνομα + ⇄ αλλαγή/αφαίρεση) και ενότητα **Υπάλληλοι** (πολλαπλοί, avatar rows + × αφαίρεση) + **drop-zone** με `＋ επιλογή` (picker).
- `＋ Νέα θέση εργασίας` στο τμήμα.

### 3. Users pool (drawer, κατ' απαίτηση)
- Ανοίγει από το toolbar («👥 Ανάθεση χρηστών»). Searchable λίστα χρηστών ως draggable avatar rows.
- Ήδη ανατεθειμένοι στην επιλεγμένη θέση → ξεθωριασμένοι.

## Ανάθεση χρηστών — δύο τρόποι
1. **Drag** avatar από το pool → πάνω σε θέση (drop-zone). Ζώνη έχει states: idle / drag-over / disabled(ήδη μέλος).
2. **Picker** dialog (`＋ επιλογή`) — searchable, keyboard-accessible fallback (καλύπτει a11y & μεγάλες λίστες).

Ο **Προϊστάμενος** ορίζεται μέσω επιλογής χρήστη (⇄), γράφεται στο `JobPosition.managerId`. Οι **Υπάλληλοι** = `UserPosition` rows.

## Persistence & server actions
- **Auto-save ανά ενέργεια** μέσω Next.js server actions (pattern ίδιο με `departments/actions.ts`, `positions/actions.ts`). Toolbar δείχνει save-status («Αποθήκευση… / ✓ Αποθηκεύτηκε / ⚠ σφάλμα»).
- Νέα/επεκταμένες actions:
  - `reparentDepartment(id, newParentId | null)` — **με έλεγχο κύκλου** (νέος γονέας δεν επιτρέπεται να είναι απόγονος του κόμβου· απαγόρευση self-parent).
  - `createDepartment / updateDepartment / deleteDepartment` (υπάρχουν).
  - `createJobPosition / updateJobPosition / deleteJobPosition` (υπάρχουν).
  - `setPositionManager(positionId, userId | null)`.
  - `assignUserToPosition(positionId, userId)` / `removeUserFromPosition(positionId, userId)` — idempotent (respect `@@unique`).
- Κάθε action: `requireRole([SUPER_ADMIN, ADMIN])`, μετά `revalidatePath`.

## Access control
- Νέα σελίδα **`/organization`** (server component: `auth()` → `requireRole([SUPER_ADMIN, ADMIN])`), fetch όλου του δέντρου + χρηστών, pass σε client component. Προσθήκη στο `nav-config.ts` (roles: SUPER_ADMIN, ADMIN).

## Tech & στυλ
- **@dnd-kit** (ήδη εγκατεστημένο) για drag-and-drop σε canvas & user assignment.
- **shadcn/ui + Tailwind 4**, DG design system (DG-Red primary, ουδέτερα surfaces, χρωματιστή ακίδα = department color).
- Γραμματοσειρά **Geist** (app default) — συνέπεια.
- Τυπογραφία: τίτλος 15px, ονόματα 13.5px, labels 10.5px uppercase, avatars 30px· `antialiased`.
- Avatars: αρχικά ονόματος, deterministic HSL από userId, WCAG-safe λευκό κείμενο.

## Component boundaries
- `page.tsx` (server) — data fetch + guard.
- `organization-client.tsx` — orchestrator (state: selectedDepartmentId, drawer open, dnd contexts).
- `OrgCanvas` — tree layout + node drag/reparent + zoom/pan/fit.
- `DepartmentNode` — μεμονωμένο κουτί (draggable + drop target).
- `DepartmentDetailPanel` — θέσεις για επιλεγμένο τμήμα.
- `PositionCard` — expandable (manager + employees + drop-zone).
- `UserPoolDrawer` — searchable draggable λίστα χρηστών.
- `UserPickerDialog` — fallback ανάθεση (manager & employees).
- `Avatar` — αρχικά + deterministic color (κοινό).
- `actions.ts` — server actions (πάνω).

## Edge cases
- Reparent που δημιουργεί κύκλο → block + toast.
- Διαγραφή τμήματος με children/θέσεις → confirm· `JobPosition` cascade, children παραμένουν (γίνονται root ή reparent στον γονέα — **default: reparent στον γονέα του διαγραφόμενου**).
- Αφαίρεση προϊσταμένου = `managerId → null`.
- Ίδιος χρήστης σε πολλές θέσεις = επιτρεπτό (unique είναι ανά (user, position)).
- Κενό τμήμα / καμία θέση / κανένας χρήστης → empty states.
- Μεγάλο δέντρο → Fit-to-screen + pan.

## Εκτός scope (YAGNI)
- Φωτό avatars (μόνο αρχικά τώρα).
- Undo/redo, version history.
- Export οργανογράμματος σε PDF/PNG (μπορεί αργότερα — υπάρχει jspdf).
- Bulk import χρηστών.
- Πολλαπλοί προϊστάμενοι ανά θέση.
