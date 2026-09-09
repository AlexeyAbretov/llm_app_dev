import { GridFSBucket, type Db } from 'mongodb';

export const GRIDFS_BUCKET = 'catalog_images';

export function createGridFSBucket(db: Db): GridFSBucket {
  return new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
}
