# Example: How to use RBAC decorators in app.py

# ============================================
# EXAMPLE 1: Admin-only route (Add Algorithm)
# ============================================
"""
@app.route('/api/algorithms', methods=['POST'])
@admin_required  # Only admins can add algorithms
def add_algorithm():
    data = request.json
    # Add new algorithm logic here
    return jsonify({'message': 'Algorithm added successfully'})
"""

# ============================================
# EXAMPLE 2: User route (Read/Write files)
# ============================================
"""
@app.route('/api/files', methods=['POST'])
@login_required  # Both users and admins can create files
def create_file():
    user_id = session.get('user_id')
    data = request.json
    # Create file logic here
    return jsonify({'message': 'File created successfully'})
"""

# ============================================
# EXAMPLE 3: Frontend Permission Check
# ============================================
"""
// In React component (e.g., NavBar.jsx or AlgorithmSelect.jsx):
import { useAuth } from '../context/useAuth';

function AlgorithmManager() {
  const { user, permission } = useAuth();
  
  return (
    <div>
      {permission === 'admin' && (
        <button onClick={handleAddAlgorithm}>
          Add New Algorithm
        </button>
      )}
      
      {/* All users can see/use algorithms */}
      <AlgorithmList />
    </div>
  );
}
"""

# ============================================
# PERMISSION SUMMARY
# ============================================
"""
User (role='user'):
  ✓ Can read algorithms
  ✓ Can write/edit their own code
  ✓ Can execute code
  ✗ Cannot add new algorithms

Admin (role='admin'):
  ✓ Everything users can do
  ✓ Can add new algorithms
  ✓ Can manage system content
"""
