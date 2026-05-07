import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://novira.one'
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/signin`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/forgot-password`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
  ]
}
