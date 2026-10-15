"use client";
import { ToolbarAction } from "./toolbar-action";
import { Button, Input } from "@cloudflare/kumo";
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  type Icon,
} from "@phosphor-icons/react";
import { ReactNode, useState, useSyncExternalStore } from "react";
import { usePhoneLayout } from "@/lib/phone-layout";
import { ActionMenu } from "./action-menu";
import { Modal } from "./shared";
import { FilterPopover } from "./filter-popover";

type Action = {
  label: string;
  icon: Icon;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
};
const compactQuery = "(640px <= width < 1024px)";
function subscribeCompact(callback: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function CollectionToolbar({
  search,
  onSearch,
  placeholder,
  filter,
  filterActive,
  actions = [],
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  filter?: ReactNode;
  filterActive?: boolean;
  actions?: Action[];
}) {
  const phone = usePhoneLayout();
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => false,
  );
  const [open, setOpen] = useState(false);
  return (
    <div className="collection-toolbar-layout">
      <div className="filter-bar collection-controls">
        <div className="search-input">
          <MagnifyingGlassIcon size={18} />
          <Input
            aria-label="Cari data"
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        {filter && !phone && (
          <FilterPopover active={filterActive}>{filter}</FilterPopover>
        )}
        {filter && (
          <>
            <Button
              className="toolbar-mobile-filter"
              variant={filterActive ? "secondary" : "outline"}
              shape="square"
              icon={
                <FunnelIcon
                  size={20}
                  weight={filterActive ? "fill" : "regular"}
                />
              }
              aria-label="Filter status"
              aria-pressed={!!filterActive}
              onClick={() => setOpen(true)}
            />
            <Modal
              open={open}
              onClose={() => setOpen(false)}
              title="Filter data"
            >
              <div className="detail-body toolbar-filter-body">
                {phone && filter}
              </div>
              <div className="form-actions">
                <Button variant="primary" onClick={() => setOpen(false)}>
                  Terapkan filter
                </Button>
              </div>
            </Modal>
          </>
        )}
        {actions.length > 0 && (
          <div className="toolbar-auxiliary-actions">
            {phone && actions.length > 1 ? (
              <ActionMenu label="Tindakan daftar" actions={actions} />
            ) : (
              actions.map((action) =>
                action.compact || compact ? (
                  <Button
                    key={action.label}
                    type="button"
                    shape="square"
                    aria-label={action.label}
                    title={action.label}
                    variant="outline"
                    className="toolbar-icon-action"
                    icon={<action.icon size={18} />}
                    disabled={action.disabled}
                    onClick={action.onSelect}
                  />
                ) : (
                  <ToolbarAction
                    key={action.label}
                    aria-label={action.label}
                    title={action.label}
                    className="toolbar-icon-action"
                    variant="outline"
                    icon={<action.icon size={18} />}
                    disabled={action.disabled}
                    onClick={action.onSelect}
                  >
                    {action.label}
                  </ToolbarAction>
                ),
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
