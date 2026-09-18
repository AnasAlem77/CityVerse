import { Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type PlaceImageWithUrl = {
  url: string;
  source?: string | null;
  [key: string]: any;
};

@Injectable()
export class PlaceImageService {
  private readonly r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  async signPlaceImages(
    images: PlaceImageWithUrl[],
  ) {
    return Promise.all(
      images.map(async (image) => {
        if (
          !image.url ||
          (image.source !== 'mapillary' &&
            image.source !== 'panoramax')
        ) {
          return image;
        }

        const marker = '/places/';
        const markerIndex = image.url.indexOf(marker);

        if (markerIndex === -1) {
          return image;
        }

        const key = image.url.slice(markerIndex + 1);

        const signedUrl = await getSignedUrl(
          this.r2Client,
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: key,
          }),
          {
            expiresIn: 3600,
          },
        );

        return {
          ...image,
          url: signedUrl,
        };
      }),
    );
  }
}
