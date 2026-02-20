"use client";

import { createContext, useContext } from "react";

type WorkspaceRoleContextValue = {
  role: string | null;
};

const WorkspaceRoleContext = createContext<WorkspaceRoleContextValue>({ role: null });

export function WorkspaceRoleProvider(props: {
  role: string | null;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceRoleContext.Provider value={{ role: props.role }}>
      {props.children}
    </WorkspaceRoleContext.Provider>
  );
}

export function useWorkspaceRole() {
  return useContext(WorkspaceRoleContext);
}
