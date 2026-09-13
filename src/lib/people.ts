import { createId, mutateCollection, nowIso, readCollection } from './storage';
import type { FaceInstance, Person } from './types';

export const FACE_MATCH_THRESHOLD = 0.55;

export function descriptorDistance(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function centroid(descriptors: number[][]): number[] {
  const size = descriptors[0]?.length ?? 0;
  const center = new Array<number>(size).fill(0);
  descriptors.forEach((descriptor) => {
    for (let i = 0; i < size; i += 1) center[i] += descriptor[i] ?? 0;
  });
  return center.map((value) => value / Math.max(1, descriptors.length));
}

export interface FaceScanInput {
  box: FaceInstance['box'];
  descriptor: number[];
  thumbUrl: string;
}

export interface AssignResult {
  people: Person[];
  assignments: Map<string, string>; // faceId -> personId
}

/**
 * 纯函数:先把 removedFaceIds 从各聚类中摘除(空聚类删除),
 * 再把 newFaces 逐张分配到成员质心距离最近的聚类(< FACE_MATCH_THRESHOLD),否则新建聚类。
 * 不触碰存储,返回新聚类状态与分配结果。
 */
export function assignFaces(
  people: Person[],
  keptFaces: FaceInstance[],
  newFaces: FaceInstance[],
  removedFaceIds: Set<string>,
  now: string
): AssignResult {
  const byId = new Map(keptFaces.map((face) => [face.id, face]));
  const assignments = new Map<string, string>();

  const working = people
    .map((person) => ({
      ...person,
      faceIds: person.faceIds.filter((id) => removedFaceIds.has(id) === false)
    }))
    .filter((person) => person.faceIds.length > 0);

  for (const face of newFaces) {
    let best: Person | null = null;
    let bestDistance = Infinity;
    for (const person of working) {
      const members = person.faceIds
        .map((id) => byId.get(id))
        .filter((item): item is FaceInstance => Boolean(item));
      if (members.length === 0) continue;
      const distance = descriptorDistance(
        centroid(members.map((member) => member.descriptor)),
        face.descriptor
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = person;
      }
    }

    if (best && bestDistance < FACE_MATCH_THRESHOLD) {
      best.faceIds.push(face.id);
      best.updatedAt = now;
      assignments.set(face.id, best.id);
    } else {
      const person: Person = {
        id: createId('person'),
        name: null,
        faceIds: [face.id],
        coverFaceId: face.id,
        hidden: false,
        createdAt: now,
        updatedAt: now
      };
      working.push(person);
      assignments.set(face.id, person.id);
    }
    byId.set(face.id, face);
  }

  working.forEach((person) => {
    if (!person.coverFaceId || person.faceIds.includes(person.coverFaceId) === false) {
      person.coverFaceId = person.faceIds[0] ?? null;
    }
  });

  return { people: working, assignments };
}

/** 整体替换某张照片的人脸扫描结果,并把新人脸归入人物聚类。 */
export async function replacePhotoFaces(photoId: string, inputs: FaceScanInput[]) {
  const now = nowIso();
  const storedFaces = await readCollection<FaceInstance>('faces');
  const removedFaceIds = new Set(
    storedFaces.filter((face) => face.photoId === photoId).map((face) => face.id)
  );
  const keptFaces = storedFaces.filter((face) => removedFaceIds.has(face.id) === false);
  const created: FaceInstance[] = inputs.map((input) => ({
    id: createId('face'),
    photoId,
    box: input.box,
    descriptor: input.descriptor,
    thumbUrl: input.thumbUrl,
    personId: null,
    createdAt: now
  }));

  const people = await readCollection<Person>('people');
  const { people: nextPeople, assignments } = assignFaces(
    people,
    keptFaces,
    created,
    removedFaceIds,
    now
  );
  created.forEach((face) => {
    face.personId = assignments.get(face.id) ?? null;
  });

  await mutateCollection<Person, void>('people', (current) => {
    current.splice(0, current.length, ...nextPeople);
  });
  await mutateCollection<FaceInstance, void>('faces', (current) => {
    const kept = current.filter((face) => face.photoId !== photoId);
    current.splice(0, current.length, ...kept, ...created);
  });

  return { faces: created, people: nextPeople };
}

export async function patchPerson(
  id: string,
  patch: { name?: string | null; coverFaceId?: string | null; hidden?: boolean }
) {
  return mutateCollection<Person, Person | null>('people', (current) => {
    const person = current.find((item) => item.id === id);
    if (!person) return null;
    if (patch.name !== undefined) person.name = patch.name;
    if (patch.hidden !== undefined) person.hidden = patch.hidden;
    if (patch.coverFaceId !== undefined && patch.coverFaceId !== null) {
      if (person.faceIds.includes(patch.coverFaceId) === false) return null;
      person.coverFaceId = patch.coverFaceId;
    }
    person.updatedAt = nowIso();
    return person;
  });
}

export async function mergePeople(sourceId: string, targetId: string) {
  if (sourceId === targetId) return null;
  const merged = await mutateCollection<Person, Person | null>('people', (current) => {
    const source = current.find((item) => item.id === sourceId);
    const target = current.find((item) => item.id === targetId);
    if (!source || !target) return null;
    target.faceIds = [...new Set([...target.faceIds, ...source.faceIds])];
    if (!target.coverFaceId || target.faceIds.includes(target.coverFaceId) === false) {
      target.coverFaceId = target.faceIds[0] ?? null;
    }
    target.updatedAt = nowIso();
    current.splice(current.indexOf(source), 1);
    return target;
  });
  if (merged === null) return null;
  await mutateCollection<FaceInstance, void>('faces', (current) => {
    current.forEach((face) => {
      if (face.personId === sourceId) face.personId = targetId;
    });
  });
  return merged;
}

export async function deleteFace(faceId: string) {
  const removed = await mutateCollection<FaceInstance, FaceInstance | null>('faces', (current) => {
    const index = current.findIndex((face) => face.id === faceId);
    if (index === -1) return null;
    const [face] = current.splice(index, 1);
    return face;
  });
  if (removed?.personId) {
    const personId = removed.personId;
    await mutateCollection<Person, void>('people', (current) => {
      const index = current.findIndex((person) => person.id === personId);
      if (index === -1) return;
      const person = current[index];
      person.faceIds = person.faceIds.filter((id) => id !== faceId);
      if (person.coverFaceId === faceId) person.coverFaceId = person.faceIds[0] ?? null;
      if (person.faceIds.length === 0) current.splice(index, 1);
      else person.updatedAt = nowIso();
    });
  }
  return removed;
}

/** 照片被彻底清除时级联删除其人脸,并清理空聚类。 */
export async function removeFacesForPhotos(photoIds: string[]) {
  const idSet = new Set(photoIds);
  const removedFaceIds = new Set<string>();
  await mutateCollection<FaceInstance, void>('faces', (current) => {
    for (let i = current.length - 1; i >= 0; i -= 1) {
      if (idSet.has(current[i].photoId)) {
        removedFaceIds.add(current[i].id);
        current.splice(i, 1);
      }
    }
  });
  if (removedFaceIds.size === 0) return;
  await mutateCollection<Person, void>('people', (current) => {
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const person = current[i];
      person.faceIds = person.faceIds.filter((id) => removedFaceIds.has(id) === false);
      if (person.coverFaceId && removedFaceIds.has(person.coverFaceId)) {
        person.coverFaceId = person.faceIds[0] ?? null;
      }
      if (person.faceIds.length === 0) current.splice(i, 1);
    }
  });
}

export interface PersonSummary {
  id: string;
  name: string | null;
  hidden: boolean;
  count: number;
  coverThumbUrl: string | null;
  faces: Array<{ id: string; photoId: string; thumbUrl: string; box: FaceInstance['box'] }>;
}

/** 管理端人物列表(剥离 descriptor,按人脸数降序)。 */
export async function listPeopleWithFaces(): Promise<PersonSummary[]> {
  const [people, faces] = await Promise.all([
    readCollection<Person>('people'),
    readCollection<FaceInstance>('faces')
  ]);
  const byId = new Map(faces.map((face) => [face.id, face]));
  return people
    .map((person) => {
      const members = person.faceIds
        .map((id) => byId.get(id))
        .filter((face): face is FaceInstance => Boolean(face));
      const cover = (person.coverFaceId ? byId.get(person.coverFaceId) : undefined) ?? members[0];
      return {
        id: person.id,
        name: person.name,
        hidden: person.hidden,
        count: members.length,
        coverThumbUrl: cover?.thumbUrl ?? null,
        faces: members.map((face) => ({
          id: face.id,
          photoId: face.photoId,
          thumbUrl: face.thumbUrl,
          box: face.box
        }))
      };
    })
    .sort((a, b) => b.count - a.count);
}
