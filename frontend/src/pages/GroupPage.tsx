import React, { useState, useEffect } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/Table";
import { Trash2 } from "lucide-react";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import { SubBrokerInfo } from "../types/broker";
import { SubBrokerFilter } from "../types/broker";
import { getSubBrokers } from "../api/brokerApi";
import { GroupCreate, GroupInfo } from "../types/group";
import { createGroup, editGroup, deleteGroup, getGroup } from "../api/groupApi";

const GroupPage: React.FC = () => {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupQuantity, setNewGroupQuantity] = useState(1);
  const [editGroupData, setEditGroupData] = useState<GroupInfo | null>(null);
  const [availableBrokers, setAvailableBrokers] = useState<SubBrokerInfo[]>([]);
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;
  const getSubBrokerAccounts = async () => {
    const subBrokerFilter: SubBrokerFilter = {
      user_id,
    };
    const brokers = await getSubBrokers(subBrokerFilter);
    if (brokers) {
      setAvailableBrokers(brokers);
    }
  };

  const getGroups = async () => {
    const groups = await getGroup(user_id);
    setGroups(groups);
  };

  useEffect(() => {
    getSubBrokerAccounts();
  }, [user_id]);

  useEffect(() => {
    getGroups();
  }, [user_id]);

  const handleCreateGroup = async () => {
    const newGroup: GroupCreate = {
      user_id: user_id,
      name: newGroupName,
      qty: newGroupQuantity,
      sub_brokers: selectedBrokers,
    };
    // setGroups([...groups, newGroup]);
    const response = await createGroup(newGroup);
    setGroups(response);
    setIsCreateModalOpen(false);
    setNewGroupName("");
    // setNewGroupQuantity(1);
    setSelectedBrokers([]);
  };

  const handleUpdateGroup = () => {
    if (!editGroupData) return;

    setGroups(
      groups.map((group) =>
        group.id === editGroupData.id ? editGroupData : group
      )
    );

    if (selectedGroup?.id === editGroupData.id) {
      setSelectedGroup(editGroupData);
    }

    setIsEditModalOpen(false);
  };

  // const handleUpdateQuantity = (groupId: string, newQuantity: number) => {
  //   setGroups(
  //     groups.map((group) =>
  //       group.id === groupId ? { ...group, quantity: newQuantity } : group
  //     )
  //   );
  //   if (selectedGroup?.id === groupId) {
  //     setSelectedGroup({ ...selectedGroup, quantity: newQuantity });
  //   }
  // };

  const handleEditClick = (group: GroupInfo) => {
    setEditGroupData(group);
    // setSelectedBrokers(group.sub_brokers);
    setIsEditModalOpen(true);
  };

  const handleDeleteGroup = async (groupID: string) => {
    const response = await deleteGroup(groupID);
    setGroups(response);
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header />
        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Groups</h1>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Group
            </Button>
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedGroup(group)}
              >
                <CardHeader>{group.name}</CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <span>Quantity: {group.qty}</span>
                    <span>Brokers: {group.sub_brokers.length}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Group Details */}
          {selectedGroup && (
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{selectedGroup.name}</h2>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={selectedGroup.qty}
                    // onChange={(e) =>
                    //   handleUpdateQuantity(
                    //     selectedGroup.id,
                    //     parseInt(e.target.value)
                    //   )
                    // }
                    className="w-20"
                  />
                  <Button onClick={() => handleEditClick(selectedGroup)}>
                    Edit
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleDeleteGroup(selectedGroup.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub Brokers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup.sub_brokers.map((sub_broker) => (
                      <TableRow key={sub_broker.id}>
                        <TableCell>{sub_broker.nickname}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Create Group Modal */}
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create New Group"
          >
            <div className="space-y-4">
              <Input
                label="Group Name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
                required
              />
              <Input
                type="number"
                label="Quantity"
                value={newGroupQuantity}
                onChange={(e) => setNewGroupQuantity(parseInt(e.target.value))}
                min="1"
                required
              />
              <div>
                <label className="block mb-2 text-sm font-medium">
                  Select Sub Brokers
                </label>
                <div className="border rounded-lg p-2 max-h-40 overflow-auto">
                  {availableBrokers.map((broker) => (
                    <div key={broker.id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={broker.id}
                        checked={selectedBrokers.includes(broker.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBrokers([...selectedBrokers, broker.id]);
                          } else {
                            setSelectedBrokers(
                              selectedBrokers.filter((b) => b !== broker.id)
                            );
                          }
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={broker.nickname}>{broker.nickname}</label>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleCreateGroup}
                disabled={!newGroupName || selectedBrokers.length === 0}
                className="w-full"
              >
                Create Group
              </Button>
            </div>
          </Modal>

          {/* Edit Group Modal */}
          <Modal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            title="Edit Group"
          >
            {editGroupData && (
              <div className="space-y-4">
                <Input
                  label="Group Name"
                  value={editGroupData.name}
                  onChange={(e) =>
                    setEditGroupData({ ...editGroupData, name: e.target.value })
                  }
                  placeholder="Enter group name"
                  required
                />
                <Input
                  type="number"
                  label="Quantity"
                  value={editGroupData.qty}
                  onChange={(e) =>
                    setEditGroupData({
                      ...editGroupData,
                      qty: parseInt(e.target.value),
                    })
                  }
                  min="1"
                  required
                />
                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Select Sub Brokers
                  </label>
                  <div className="border rounded-lg p-2 max-h-40 overflow-auto">
                    {availableBrokers.map((broker) => (
                      <div key={broker.id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          id={`edit-${broker}`}
                          checked={editGroupData.sub_brokers.includes(broker)}
                          onChange={(e) => {
                            const updatedBrokers = e.target.checked
                              ? [...editGroupData.sub_brokers, broker]
                              : editGroupData.sub_brokers.filter(
                                  (b) => b !== broker
                                );
                            setEditGroupData({
                              ...editGroupData,
                              sub_brokers: updatedBrokers,
                            });
                          }}
                          className="mr-2"
                        />
                        <label htmlFor={`edit-${broker}`}>
                          {broker.nickname}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleUpdateGroup}
                  disabled={
                    !editGroupData.name || editGroupData.sub_brokers.length === 0
                  }
                  className="w-full"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </Modal>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default GroupPage;
