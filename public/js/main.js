// public/js/main.js

document.addEventListener('DOMContentLoaded', function () {
  // Edit modal logic
  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  let currentId = null;

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      currentId = this.dataset.id;
      document.getElementById('edit-name').value = this.dataset.name;
      document.getElementById('edit-email').value = this.dataset.email;
      document.getElementById('edit-mobile').value = this.dataset.mobile;
      document.getElementById('edit-designation').value = this.dataset.designation;
      document.getElementById('edit-category').value = this.dataset.category;
      editForm.action = '/edit/' + currentId;
      editModal.classList.remove('hidden');
      editModal.classList.add('flex');
    });
  });

  document.getElementById('editCancel').addEventListener('click', function () {
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
  });

  // Optional: Close modal on outside click
  editModal.addEventListener('click', function (e) {
    if (e.target === editModal) {
      editModal.classList.add('hidden');
      editModal.classList.remove('flex');
    }
  });
});