"use client"

import { useState } from "react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { PeoplePicker } from "@/components/ui/people-picker"
import type { SelectOption } from "@/components/ui/searchable-select"
import type { Person } from "@/components/ui/people-picker"

export interface ScopeLead extends SelectOption {
  locationId?: string | null
}

interface ScopeSelectorProps {
  scopeType:        string
  scopeId:          string
  onScopeIdChange:  (id: string) => void
  locations:        SelectOption[]
  departments:      SelectOption[]
  teamLeads:        ScopeLead[]
  users:            Person[]
}

export function ScopeSelector({
  scopeType,
  scopeId,
  onScopeIdChange,
  locations,
  departments,
  teamLeads,
  users,
}: ScopeSelectorProps) {
  const [teamLocationId, setTeamLocationId] = useState("")

  if (scopeType === "org" || !scopeType) return null

  if (scopeType === "location") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Which location?
        </label>
        <SearchableSelect
          options={locations}
          value={scopeId}
          onChange={onScopeIdChange}
          placeholder="Search locations..."
          emptyLabel="Select a location"
        />
      </div>
    )
  }

  if (scopeType === "department") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Which department?
        </label>
        <SearchableSelect
          options={departments}
          value={scopeId}
          onChange={onScopeIdChange}
          placeholder="Search departments..."
          emptyLabel="Select a department"
        />
      </div>
    )
  }

  if (scopeType === "team") {
    const visibleLeads = teamLocationId
      ? teamLeads.filter(l => l.locationId === teamLocationId)
      : teamLeads

    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Filter by location (optional)
          </label>
          <SearchableSelect
            options={locations}
            value={teamLocationId}
            onChange={id => { setTeamLocationId(id); onScopeIdChange("") }}
            placeholder="All locations"
            emptyLabel="All locations"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Which team lead?
            {teamLocationId && visibleLeads.length === 0 && (
              <span className="ml-1 text-gray-400 font-normal">(none at this location)</span>
            )}
          </label>
          <PeoplePicker
            people={visibleLeads.map(l => ({ id: l.id, name: l.name }))}
            value={scopeId}
            onChange={onScopeIdChange}
            placeholder="Search managers / supervisors..."
            emptyLabel="Select a team lead"
            disabled={teamLocationId !== "" && visibleLeads.length === 0}
          />
        </div>
      </div>
    )
  }

  if (scopeType === "individual") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Which person?
        </label>
        <PeoplePicker
          people={users}
          value={scopeId}
          onChange={onScopeIdChange}
          placeholder="Search people..."
          emptyLabel="Select a person"
        />
      </div>
    )
  }

  return null
}
