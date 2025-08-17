// 文件上传功能（封面图自动从视频中截取）
async function generateVideoThumbnail(videoFile) {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  const url = URL.createObjectURL(videoFile);
  video.src = url;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = reject;
  });

  // Seek to middle of the video
  video.currentTime = video.duration / 2;
  await new Promise((resolve) => {
    video.onseeked = resolve;
  });

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl;
}

// 上传封面图与视频
uploadForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = uploadForm.getAttribute('data-id');
  const poster = upPoster.files?.[0] || pastedPosterFile || null;
  const video = upVideo.files?.[0] || null;

  if (!poster && !video) {
    upTip.textContent = '请选择文件或粘贴图片';
    return;
  }

  const stop = fakeProgressStart();
  try {
    let posterUrl = null, videoUrl = null;
    if (poster) {
      posterUrl = await uploadToBucket(`projects/${id}/poster-${Date.now()}.${extOf(poster.name, 'png')}`, poster);
    }
    if (video) {
      videoUrl = await uploadToBucket(`projects/${id}/final-${Date.now()}.${extOf(video.name, 'mp4')}`, video);

      // 如果没有上传封面，自动从视频中截取封面
      if (!posterUrl) {
        const thumbnail = await generateVideoThumbnail(video);
        posterUrl = await uploadToBucket(`projects/${id}/thumbnail-${Date.now()}.png`, new File([thumbnail], 'thumbnail.png'));
      }
    }

    const patch = {};
    if (posterUrl) patch.poster_url = posterUrl;
    if (videoUrl) patch.final_link = videoUrl;
    if (Object.keys(patch).length) await supa.from('projects').update(patch).eq('id', id);

    stop();
    upTip.textContent = '上传完成';
    await fetchProjects();
    renderAll();
    setTimeout(closeUploadModal, 300);
  } catch (err) {
    console.error(err);
    stop();
    upTip.textContent = '上传失败：' + (err?.message || '');
  }
});
