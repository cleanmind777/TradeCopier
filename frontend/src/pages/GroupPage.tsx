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
import { SubBrokerInfo, SubBrokerSummary } from "../types/broker";
import { SubBrokerFilter } from "../types/broker";
import { getSubBrokers, getSubBrokersForGroup } from "../api/brokerApi";
import { GroupCreate, GroupInfo } from "../types/group";
import { createGroup, editGroup, deleteGroup, getGroup } from "../api/groupApi";

const GroupPage: React.FC = () => {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupQuantity, setNewGroupQuantity] = useState(1);
  const [editGroupData, setEditGroupData] = useState<GroupInfo | null>(null);
  const [availableBrokers, setAvailableBrokers] = useState<SubBrokerSummary[]>(
    []
  );
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);

  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  const getSubBrokerAccounts = async () => {
    const brokers = await getSubBrokersForGroup(user_id);
    if (brokers) {
      setAvailableBrokers(brokers);
    } else {
      alert("You don't have Trading Account, Plz connect!");
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
    const response = await createGroup(newGroup);
    setGroups(response);
    setIsCreateModalOpen(false);
    setNewGroupName("");
    setSelectedBrokers([]);
  };

  const handleUpdateGroup = async () => {
    if (!editGroupData) return;

    const groupEditData = {
      ...editGroupData,
      sub_brokers: editGroupData.sub_brokers.map((broker) => broker.id),
    };
    const response = await editGroup(groupEditData);
    setGroups(response);
    setIsEditModalOpen(false);
  };

  const handleEditClick = (group: GroupInfo) => {
    setEditGroupData(group);
    setIsEditModalOpen(true);
  };

  const handleDeleteGroup = async (groupID: string) => {
    const response = await deleteGroup(groupID);
    setGroups(response);
    if (selectedGroup?.id === groupID) {
      setSelectedGroup(null);
      setIsDetailsModalOpen(false);
    }
  };

  return (
    <div className="flex bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 space-y-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Groups</h1>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              disabled={!availableBrokers || availableBrokers.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Group
            </Button>
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border border-gray-200 rounded-lg overflow-hidden"
                onClick={() => {
                  setSelectedGroup(group);
                  setIsDetailsModalOpen(true);
                }}
              >
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {group.name}
                    </h2>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {group.sub_brokers.length} brokers
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">Quantity</p>
                      <p className="text-lg font-medium">{group.qty}</p>
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(group);
                        }}
                        className="text-blue-600 hover:bg-blue-50"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Group Details Modal */}
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            title={
              "Group Details"
            }
            className="max-w-2xl"
          >
            {selectedGroup && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Quantity</p>
                      <p className="text-lg font-semibold">
                        {selectedGroup.qty}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={() => handleEditClick(selectedGroup)}>
                        Edit Group
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleDeleteGroup(selectedGroup.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    Brokers in this group
                  </h3>
                  <Table className="border rounded-lg">
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="bg-gray-50">Nickname</TableHead>
                        <TableHead className="bg-gray-50">
                          Account Name
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGroup.sub_brokers.map((sub_broker) => (
                        <TableRow
                          key={sub_broker.id}
                          className="hover:bg-gray-50"
                        >
                          <TableCell className="font-medium">
                            {sub_broker.nickname}
                          </TableCell>
                          <TableCell>{sub_broker.sub_account_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Modal>

          {/* Create Group Modal */}
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create New Group"
            className="max-w-[800px] w-full"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Input
                    label="Group Name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    label="Quantity"
                    value={newGroupQuantity}
                    onChange={(e) =>
                      setNewGroupQuantity(parseInt(e.target.value))
                    }
                    min="1"
                    className="w-full"
                    required
                  />
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Sub Brokers
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2">
                  {availableBrokers.map((broker) => (
                    <div
                      key={broker.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedBrokers.includes(broker.id)
                          ? "bg-blue-50 border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        if (selectedBrokers.includes(broker.id)) {
                          setSelectedBrokers(
                            selectedBrokers.filter((b) => b !== broker.id)
                          );
                        } else {
                          setSelectedBrokers([...selectedBrokers, broker.id]);
                        }
                      }}
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-4 h-4 rounded-sm border mr-3 flex items-center justify-center ${
                            selectedBrokers.includes(broker.id)
                              ? "bg-blue-500 border-blue-500"
                              : "bg-white border-gray-300"
                          }`}
                        >
                          {selectedBrokers.includes(broker.id) && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {broker.nickname}
                          </p>
                          <p className="text-xs text-gray-500">
                            {broker.sub_account_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  disabled={!newGroupName || selectedBrokers.length === 0}
                  className="px-6 bg-blue-600 hover:bg-blue-700"
                >
                  Create Group
                </Button>
              </div>
            </div>
          </Modal>

          {/* Edit Group Modal */}
          <Modal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            title="Edit Group"
            className="max-w-[800px] w-full"
          >
            {editGroupData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Input
                      label="Group Name"
                      value={editGroupData.name}
                      onChange={(e) =>
                        setEditGroupData({
                          ...editGroupData,
                          name: e.target.value,
                        })
                      }
                      placeholder="Enter group name"
                      className="w-full"
                      required
                    />
                  </div>
                  <div>
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
                      className="w-full"
                      required
                    />
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Sub Brokers
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2">
                    {availableBrokers.map((broker) => (
                      <div
                        key={broker.id}
                        className={`p-3 rounded-md border cursor-pointer transition-colors ${
                          editGroupData.sub_brokers.some(
                            (b) => b.id === broker.id
                          )
                            ? "bg-blue-50 border-blue-200"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          const updatedBrokers = editGroupData.sub_brokers.some(
                            (b) => b.id === broker.id
                          )
                            ? editGroupData.sub_brokers.filter(
                                (b) => b.id !== broker.id
                              )
                            : [...editGroupData.sub_brokers, broker];
                          setEditGroupData({
                            ...editGroupData,
                            sub_brokers: updatedBrokers,
                          });
                        }}
                      >
                        <div className="flex items-center">
                          <div
                            className={`w-4 h-4 rounded-sm border mr-3 flex items-center justify-center ${
                              editGroupData.sub_brokers.some(
                                (b) => b.id === broker.id
                              )
                                ? "bg-blue-500 border-blue-500"
                                : "bg-white border-gray-300"
                            }`}
                          >
                            {editGroupData.sub_brokers.some(
                              (b) => b.id === broker.id
                            ) && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {broker.nickname}
                            </p>
                            <p className="text-xs text-gray-500">
                              {broker.sub_account_name}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateGroup}
                    disabled={
                      !editGroupData.name ||
                      editGroupData.sub_brokers.length === 0
                    }
                    className="px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    Save Changes
                  </Button>
                </div>
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
