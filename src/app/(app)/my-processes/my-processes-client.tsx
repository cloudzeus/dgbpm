"use client";

import { ProcessInstancesAccordion, type ProcessInstanceWithTasks } from "@/app/(app)/process-instances/process-instances-accordion";

export function MyProcessesClient({
  instances,
  currentUserId,
  isSuperOrAdmin,
}: {
  instances: ProcessInstanceWithTasks[];
  currentUserId: string;
  isSuperOrAdmin: boolean;
}) {
  if (instances.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Δεν έχετε ξεκινήσει καμία διαδικασία ακόμη.
      </p>
    );
  }

  return (
    <ProcessInstancesAccordion
      instances={instances}
      currentUserId={currentUserId}
      isSuperOrAdmin={isSuperOrAdmin}
    />
  );
}
