<%- include('layout', { title: 'Admin Panel', body: `
<div>
    <h2 class="text-2xl font-bold mb-4 text-blue-400">Admin Panel</h2>

    <div class="flex justify-between mb-4">
        <form action="/upload-csv" method="POST" enctype="multipart/form-data" class="flex space-x-2">
            <input type="file" name="csvfile" accept=".csv" required class="bg-gray-700 p-2 text-white rounded">
            <button class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">Upload CSV</button>
        </form>

        <a href="/export-csv" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">Export CSV</a>
    </div>

    <!-- Search -->
    <div class="mb-4">
        <input id="search" type="text" placeholder="Search by name, email..." class="w-full p-2 border rounded text-black">
    </div>

    <!-- Attendees Table -->
    <table class="w-full border-collapse bg-gray-800 rounded-lg overflow-hidden">
        <thead>
            <tr class="bg-gray-700 text-white">
                <th class="p-2">ID</th>
                <th class="p-2">Name</th>
                <th class="p-2">Email</th>
                <th class="p-2">Mobile</th>
                <th class="p-2">Role</th>
                <th class="p-2">Status</th>
                <th class="p-2">Actions</th>
            </tr>
        </thead>
        <tbody id="attendee-table">
            <% attendees.forEach(att => { %>
            <tr class="border-b border-gray-700">
                <td class="p-2"><%= att.id %></td>
                <td class="p-2"><%= att.name %></td>
                <td class="p-2"><%= att.email %></td>
                <td class="p-2"><%= att.mobile %></td>
                <td class="p-2"><%= att.role %></td>
                <td class="p-2 <%= att.verified ? 'text-green-400' : 'text-yellow-400' %>">
                    <%= att.verified ? 'Verified' : 'Pending' %>
                </td>
                <td class="p-2 space-x-2">
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded edit-btn" data-id="<%= att.id %>">Edit</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded delete-btn" data-id="<%= att.id %>">Delete</button>
                    <button class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded print-btn" data-id="<%= att.id %>">Print</button>
                </td>
            </tr>
            <% }) %>
        </tbody>
    </table>
</div>
` }) %>
