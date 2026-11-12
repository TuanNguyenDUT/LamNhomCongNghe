/**
 * TASK 14: Logic Giao diện (UI) Bảng tin thông báo tập trung
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const state = {
  page: 1,
  limit: 5,
  source_type: 'ALL',
  priority: 'ALL',
  scope_type: 'ALL',
  course_code: 'ALL',
  is_read: 'ALL',
  q: '',
};

const PRIORITY_LABELS = {
  URGENT: '🔥 KHẨN CẤP',
  HIGH: '⚡ ƯU TIÊN CAO',
  MEDIUM: '📌 TRUNG BÌNH',
  LOW: '🌿 THÔNG THƯỜNG',
};

const SCOPE_LABELS = {
  PERSONAL: '👤 Tin riêng cá nhân',
  CLASS: '🏫 Lớp học phần',
  GENERAL: '🌐 Thông báo chung',
};

const SOURCE_LABELS = {
  TRAINING_DEPT: '🏛️ Phòng Đào tạo',
  FACULTY: '🎓 Khoa CNTT',
  CLASS: '📚 Lớp học phần',
  STUDENT_EMAIL: '✉️ Email Sinh viên',
  EXTRACURRICULAR: '🌱 Ngoại khóa / CLB',
};

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message) {
  const banner = document.getElementById('toastBanner');
  banner.textContent = message;
  banner.classList.remove('hidden');
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 4500);
}

async function fetchStatsAndCourses() {
  const res = await fetch('/api/notifications/stats');
  const json = await res.json();
  if (json.status !== 'success') return;

  const data = json.data;
  document.getElementById('statTotal').textContent = data.total;
  document.getElementById('statUnread').textContent = `${data.unread_count} tin chưa đọc`;
  document.getElementById('statHighPriority').textContent = data.high_priority_count;
  document.getElementById('statTargeted').textContent = data.targeted_count;
  document.getElementById('statCacheHit').textContent = `Cache Hit Rate: ${data.cache.hitRate}% (${data.cache.hits} hits)`;

  // Đổ danh sách môn học vào bộ lọc nếu chưa có
  const courseSelect = document.getElementById('filterCourse');
  if (courseSelect.options.length <= 1 && Array.isArray(data.courses)) {
    for (const c of data.courses) {
      const opt = document.createElement('option');
      opt.value = c.course_code;
      opt.textContent = `${c.course_code} - ${c.course_name}`;
      courseSelect.appendChild(opt);
    }
  }
}

async function fetchFeed() {
  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    source_type: state.source_type,
    priority: state.priority,
    scope_type: state.scope_type,
    course_code: state.course_code,
    is_read: state.is_read,
    q: state.q,
  });

  const res = await fetch(`/api/notifications?${params.toString()}`);
  const json = await res.json();
  if (json.status !== 'success') return;

  const { items, pagination, performance } = json.data;
  document.getElementById('statQueryTime').textContent = `${performance.query_time_ms} ms`;

  renderFeedItems(items);
  renderPagination(pagination);
}

function renderFeedItems(items = []) {
  const container = document.getElementById('feedList');
  if (items.length === 0) {
    container.innerHTML = `
      <div class="feed-card" style="text-align:center; padding: 32px;">
        <p style="font-weight:600; margin-bottom:6px;">Không tìm thấy thông báo phù hợp với bộ lọc hiện tại.</p>
        <p style="font-size:0.85rem; color:#64748b;">Hãy thử từ khóa khác hoặc nhấn "Đồng bộ / Cào tin đa nguồn".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const dateStr = new Date(item.published_at).toLocaleString('vi-VN');
      const tagsHtml = (item.tags || [])
        .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
        .join('');

      const courseBadge = item.course_tag
        ? `<span class="badge badge-course">${escapeHtml(item.course_tag)}</span>`
        : '';

      return `
        <article class="feed-card ${item.is_read ? '' : 'unread'} priority-${escapeHtml(item.priority)}">
          <div class="card-top">
            <div class="badge-group">
              <span class="badge badge-priority-${escapeHtml(item.priority)}">
                ${PRIORITY_LABELS[item.priority] || item.priority} (${item.priority_score}đ)
              </span>
              <span class="badge badge-source">
                ${SOURCE_LABELS[item.source_type] || escapeHtml(item.channel_name)}
              </span>
              <span class="badge badge-scope-${escapeHtml(item.scope_type)}">
                ${SCOPE_LABELS[item.scope_type] || item.scope_type}
              </span>
              ${courseBadge}
            </div>
            <span class="card-time">🕒 ${escapeHtml(dateStr)}</span>
          </div>

          <h3 class="card-title">
            ${item.is_pinned ? '📌 ' : ''}${escapeHtml(item.title)}
          </h3>
          <p class="card-content">${escapeHtml(item.content)}</p>

          <div class="card-footer">
            <div class="tag-list">
              ${tagsHtml}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:0.78rem; color:#64748b;">
                Từ: <strong>${escapeHtml(item.sender_name || item.channel_name)}</strong>
              </span>
              <button
                class="btn btn-sm"
                onclick="toggleReadStatus(${item.id}, ${!item.is_read})"
              >
                ${item.is_read ? 'Đánh dấu chưa đọc' : '✓ Đã đọc'}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderPagination(pagination) {
  const info = document.getElementById('paginationInfo');
  const indicator = document.getElementById('pageIndicator');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');

  info.textContent = `Hiển thị trang ${pagination.page} / ${pagination.total_pages} (Tổng ${pagination.total} thông báo)`;
  indicator.textContent = `${pagination.page} / ${pagination.total_pages}`;
  btnPrev.disabled = !pagination.has_prev;
  btnNext.disabled = !pagination.has_next;
}

async function fetchIngestionLogs() {
  const res = await fetch('/api/ingest/logs');
  const json = await res.json();
  if (json.status !== 'success') return;

  const list = document.getElementById('ingestionLogsList');
  list.innerHTML = json.data
    .map(
      (log) => `
      <div class="log-item">
        <div><strong>${escapeHtml(log.batch_id)}</strong> • <span style="color:#16a34a;">${log.duration_ms} ms</span></div>
        <div style="color:#475569; margin-top:2px;">
          Nguồn: ${escapeHtml(log.source_code)} | Quét: ${log.fetched_count} | Mới: <strong>+${log.inserted_count}</strong> | Trùng: ${log.duplicate_count}
        </div>
      </div>
    `
    )
    .join('');
}

async function toggleReadStatus(id, isRead) {
  await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: isRead }),
  });
  await refreshAll();
}

window.toggleReadStatus = toggleReadStatus;

async function refreshAll() {
  await Promise.all([fetchFeed(), fetchStatsAndCourses(), fetchIngestionLogs()]);
}

// Khởi tạo sự kiện UI
document.addEventListener('DOMContentLoaded', () => {
  refreshAll();

  // Tabs lọc nguồn
  document.getElementById('sourceTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.source_type = btn.dataset.source;
    state.page = 1;
    fetchFeed();
  });

  // Tìm kiếm từ khóa
  let searchTimer = null;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = e.target.value.trim();
      state.page = 1;
      fetchFeed();
    }, 220);
  });

  // Các dropdown lọc
  document.getElementById('filterPriority').addEventListener('change', (e) => {
    state.priority = e.target.value;
    state.page = 1;
    fetchFeed();
  });

  document.getElementById('filterScope').addEventListener('change', (e) => {
    state.scope_type = e.target.value;
    state.page = 1;
    fetchFeed();
  });

  document.getElementById('filterCourse').addEventListener('change', (e) => {
    state.course_code = e.target.value;
    state.page = 1;
    fetchFeed();
  });

  document.getElementById('filterRead').addEventListener('change', (e) => {
    state.is_read = e.target.value;
    state.page = 1;
    fetchFeed();
  });

  // Phân trang
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      fetchFeed();
    }
  });

  document.getElementById('btnNextPage').addEventListener('click', () => {
    state.page += 1;
    fetchFeed();
  });

  // Nút Cào tin đa nguồn (Task 12)
  document.getElementById('btnCrawlNow').addEventListener('click', async () => {
    const res = await fetch('/api/ingest/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (json.status === 'success') {
      const d = json.data;
      showToast(
        `✅ Đã cào đồng thời từ 4 kênh nguồn trong ${d.duration_ms}ms: Quét ${d.fetched_count} tin, thêm mới +${d.inserted_count} tin, lọc trùng ${d.duplicate_count} tin.`
      );
      await refreshAll();
    }
  });

  // Đánh dấu đã đọc tất cả
  document.getElementById('btnMarkAllRead').addEventListener('click', async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' });
    showToast('✓ Đã đánh dấu toàn bộ thông báo là đã đọc.');
    await refreshAll();
  });

  // Xem trước phân loại (Task 13)
  document.getElementById('btnPreviewClassify').addEventListener('click', async () => {
    const source_type = document.getElementById('inputSourceType').value;
    const title = document.getElementById('inputTitle').value.trim();
    const content = document.getElementById('inputContent').value.trim();

    if (!title && !content) {
      showToast('⚠️ Vui lòng nhập tiêu đề hoặc nội dung để xem trước phân loại.');
      return;
    }

    const res = await fetch('/api/classify/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_type, title, content }),
    });
    const json = await res.json();
    if (json.status === 'success') {
      const p = json.data;
      const box = document.getElementById('classifyPreviewBox');
      box.classList.remove('hidden');
      box.innerHTML = `
        <div><strong>Độ ưu tiên:</strong> <span class="badge badge-priority-${p.priority}">${p.priority} (${p.priority_score}/100)</span></div>
        <div style="margin-top:4px;"><strong>Phân loại:</strong> ${SCOPE_LABELS[p.scope_type] || p.scope_type}</div>
        <div style="margin-top:4px;"><strong>Tag môn học:</strong> ${p.course_tag || 'Không có mã môn cụ thể'}</div>
        <div style="margin-top:4px;"><strong>Hashtags:</strong> ${(p.tags || []).join(' ')}</div>
      `;
    }
  });

  // Form thêm thông báo mới qua Webhook API
  document.getElementById('ingestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const source_type = document.getElementById('inputSourceType').value;
    const title = document.getElementById('inputTitle').value.trim();
    const content = document.getElementById('inputContent').value.trim();

    const sourceMap = {
      TRAINING_DEPT: { code: 'PORTAL_PDT', name: 'Phòng Đào tạo Đại học' },
      FACULTY: { code: 'FACULTY_IT', name: 'Khoa Công nghệ Thông tin' },
      CLASS: { code: 'CLASS_LMS', name: 'Lớp học phần (LMS)' },
      STUDENT_EMAIL: { code: 'EMAIL_SV', name: 'Email Sinh viên' },
      EXTRACURRICULAR: { code: 'CLUB_EXTRA', name: 'Kênh Ngoại khóa & CLB' },
    };

    const meta = sourceMap[source_type] || sourceMap.TRAINING_DEPT;
    const res = await fetch('/api/ingest/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_code: meta.code,
        source_type,
        channel_name: meta.name,
        title,
        content,
      }),
    });

    const json = await res.json();
    if (json.status === 'success') {
      const n = json.data.notification;
      showToast(
        `✅ Đã thu thập & tự động phân loại: [${n.priority} - ${n.priority_score}đ] ${n.course_tag || ''} (${n.scope_type})`
      );
      document.getElementById('inputTitle').value = '';
      document.getElementById('inputContent').value = '';
      document.getElementById('classifyPreviewBox').classList.add('hidden');
      state.page = 1;
      await refreshAll();
    }
  });
});
