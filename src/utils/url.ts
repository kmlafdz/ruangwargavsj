/**
 * Utility functions for URL parsing and transformation.
 */

/**
 * Converts a standard YouTube link (watch, mobile, shorts, share link) 
 * into a YouTube embed format URL that can be loaded in an iframe.
 * If the URL is not a YouTube link, returns the original URL.
 * 
 * @param url The input URL to check and convert.
 * @returns The converted embed URL or the original URL.
 */
export const getEmbedUrl = (url: string): string => {
  if (!url) return '';
  try {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
    const match = url.match(youtubeRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  } catch (e) {
    console.error('Error parsing YouTube URL:', e);
  }
  return url;
};
