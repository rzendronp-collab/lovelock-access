CREATE POLICY "organizations_insert_owner"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "organizations_update_owner"
ON public.organizations
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "organizations_delete_owner"
ON public.organizations
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "memberships_insert_org_owner"
ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "memberships_update_org_owner"
ON public.memberships
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND o.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "memberships_delete_org_owner"
ON public.memberships
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND o.owner_id = auth.uid()
  )
);