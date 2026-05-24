import type { Node, Relationship } from 'neo4j-driver';
import { TRAMA_NODE_CATEGORIES } from '../../apps/modules/graph/const/node-categories.const';
import type { TramaNodeCategory, TramaNodeType } from '../../apps/modules/graph/graph.types';
import type { TramaRelationshipType } from '../../apps/modules/graph/const/relationship-types.const';
import type { GraphEdgeResponse, GraphNodeResponse } from '../schemas/graph-node-response.schema';

const TYPE_TO_CATEGORY = new Map<string, TramaNodeCategory>(
  (Object.entries(TRAMA_NODE_CATEGORIES) as [TramaNodeCategory, readonly string[]][]).flatMap(
    ([category, types]) =>
      types.map((type) => [type, category] as [string, TramaNodeCategory]),
  ),
);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function deriveLabel(type: string, props: Record<string, unknown>): string {
  const truncate = (s: string, max = 50) =>
    s.length > max ? s.slice(0, max - 1) + '…' : s;

  return (
    str(props.name) ??
    str(props.displayName) ??
    str(props.fullName) ??
    (props.value !== undefined ? truncate(String(props.value)) : undefined) ??
    str(props.domainName) ??
    str(props.handle) ??
    str(props.username) ??
    (props.text !== undefined ? truncate(String(props.text)) : undefined) ??
    type
  );
}

export function toGraphNodeResponse(rawNode: Node): GraphNodeResponse {
  const props = rawNode.properties as Record<string, unknown>;
  const type = props.type as TramaNodeType;
  const category: TramaNodeCategory = TYPE_TO_CATEGORY.get(type) ?? 'evidenceSources';

  return {
    id: props.id as string,
    type,
    category,
    label: deriveLabel(type, props),
    properties: props,
    createdAt: props.createdAt as string,
    updatedAt: props.updatedAt as string,
  };
}

export function toGraphEdgeResponse(
  rel: Relationship,
  fromId: string,
  toId: string,
): GraphEdgeResponse {
  const props = rel.properties as Record<string, unknown>;
  const type = rel.type as TramaRelationshipType;

  return {
    id: `${fromId}_${type}_${toId}`,
    source: fromId,
    target: toId,
    type,
    label: type.toLowerCase().replace(/_/g, ' '),
    properties: Object.keys(props).length > 0 ? props : undefined,
  };
}
